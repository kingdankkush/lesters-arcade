// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IRankedScoreReader, IRankedEntryReader} from "./interfaces/IRankedReaders.sol";

/// @title WeeklyJackpot
/// @author Lester's Arcade Core
/// @notice The Chikun Weekly Jackpot (design docs/game-design/chikun-weekly-jackpot-design-20260924.md §A).
///         One instance per (game, prize token). It READS the truth from the deployed 1.8.x
///         ScoreSubmissionRegistry.getSession and ArcadeRankedEntry.getPaidSession and changes nothing there.
///         Every ISO week (Monday 00:00 UTC to the next Monday) keeps the top 5 eligible verified Ranked runs,
///         one per wallet, ordered like the weekly board (score DESC, submittedAt ASC, sessionId ASC). After the
///         week closes (C), runs must be on chain by C + 6 h, proposals close at C + 12 h (a displaced, listed
///         run may be re-listed until payoutAt - 2 h), and from C + 24 h anyone may finalize: the highest
///         candidate that is not disqualified is paid if, and only if, it is cleared. A week without an
///         eligible winner rolls into the current week; a zero pot records no winner.
/// @dev    Nobody can withdraw a prize except its winner. The only other outflows are refundAfterEnd (a
///         funder's own contribution to a week after a scheduled end), recoverResidual (the residual recipient,
///         30 days after a scheduled end) and sweepStray (only the balance above liabilities). Invariant:
///         token.balanceOf(this) >= liabilities and
///         liabilities == sum(open funded + carriedIn) + sum(unclaimed) + residual.
///         Amounts carried after a scheduled end go to `residual`; their events then carry toWeek == 0.
contract WeeklyJackpot is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Constants and week math (§A.2)
    // ---------------------------------------------------------------------

    uint64 public constant WEEK = 7 days;
    /// @notice weekOf(ts) = (ts + WEEK_SHIFT) / WEEK: boundaries fall on Monday 00:00 UTC.
    uint64 public constant WEEK_SHIFT = 3 days;
    uint64 public constant SETTLE_GRACE = 6 hours;
    uint64 public constant CANDIDATE_WINDOW = 12 hours;
    uint64 public constant PAYOUT_DELAY = 24 hours;
    uint32 public constant MAX_EXTENSION = 72 hours;
    uint8 public constant MAX_CANDIDATES = 5;
    uint64 public constant RELIST_MARGIN = 2 hours;
    uint64 public constant MAX_FUND_AHEAD_WEEKS = 8;
    uint256 public constant MAX_PENDING_EPOCHS = 8;
    uint64 public constant UNCLAIMED_AFTER = 180 days;
    uint64 public constant RESIDUAL_DELAY = 30 days;

    uint8 private constant MODE_SUBMIT = 0;
    uint8 private constant MODE_ADMIN = 1;
    uint8 private constant MODE_REINSTATE = 2;

    // ---------------------------------------------------------------------
    // Types and state (§A.4)
    // ---------------------------------------------------------------------

    /// @notice One rules epoch; applies to weeks >= fromWeek until the next epoch.
    struct Rules {
        uint64 fromWeek;
        uint64 maxSurvivalSeconds; // 0 = none
        bool adminClearOnly; // true: only the admin may clear, so every payout is manual
        uint128 minPaidWei; // minimum ArcadeRankedEntry amount of the run's paid session
        uint128 maxPrizeWei; // 0 = no cap; the excess rolls into the current week
        uint128 minFundWei; // > 0; the minimum per fund call
        uint256 maxScore; // 0 = none
        bytes32 seasonId; // required
        bytes32 altSeasonId; // 0 = none
    }

    struct Candidate {
        bytes32 sessionId;
        address player;
        uint64 submittedAt;
        uint64 score;
    }

    enum WeekStatus {
        Open,
        Paid,
        RolledOver
    }

    struct Week {
        uint256 funded;
        uint256 carriedIn;
        uint256 prize;
        uint256 unclaimed;
        address winner;
        bytes32 winningSession;
        uint64 finalizedAt;
        uint32 extension;
        uint8 count;
        WeekStatus status;
        bool held;
    }

    enum Review {
        None,
        Cleared,
        Flagged,
        Disqualified
    }

    bytes32 public immutable gameId;
    IERC20 public immutable token;
    IRankedScoreReader public immutable scoreRegistry;
    IRankedEntryReader public immutable rankedEntry;
    uint64 public immutable firstWeek;

    address public residualRecipient;
    address public pendingResidualRecipient;

    address public operator;
    address public pendingOperator;
    address public admin;
    address public pendingAdmin;
    address public keeper;
    bool public adminPaused;
    bool public operatorPaused;

    Rules[] private _rules;
    mapping(uint64 => Week) private _weeks;
    mapping(uint64 => Candidate[5]) private _candidates;
    mapping(bytes32 => Review) public reviewOf;
    mapping(bytes32 => bytes32) public reviewReason;
    mapping(bytes32 => bool) public adminReviewed;
    mapping(bytes32 => bool) public wasListed;
    mapping(uint64 => mapping(address => bool)) public walletDisqualified;
    mapping(address => bool) public blocked;
    mapping(address => bool) public staffEver;
    mapping(uint64 => mapping(address => uint256)) public fundedBy;
    uint256 public liabilities;
    uint256 public residual;
    uint64 public residualAvailableAt;
    uint64 public endAfterWeek;

    // ---------------------------------------------------------------------
    // Events (§A.13)
    // ---------------------------------------------------------------------

    event Funded(uint64 indexed week, address indexed funder, uint256 amount);
    event RolledOver(uint64 indexed fromWeek, uint64 indexed toWeek, uint256 amount);
    event CapExcessCarried(uint64 indexed fromWeek, uint64 indexed toWeek, uint256 amount);
    event CandidateSubmitted(
        uint64 indexed week,
        bytes32 indexed sessionId,
        address indexed player,
        uint256 score,
        uint64 submittedAt,
        address submitter,
        uint8 rank
    );
    event CandidateRemoved(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason);
    event CandidateSkipped(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason);
    event LeaderChanged(uint64 indexed week, bytes32 indexed sessionId, address indexed player, uint256 score);
    event Cleared(bytes32 indexed sessionId, address indexed by);
    event Flagged(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason, address indexed by);
    event Disqualified(
        uint64 indexed week, bytes32 indexed sessionId, address indexed player, bool wholeWalletForWeek, bytes32 reason
    );
    event Reinstated(uint64 indexed week, bytes32 indexed sessionId);
    event WalletBlocked(address indexed wallet, bool blocked, bytes32 reason);
    event WeekHeld(uint64 indexed week, bytes32 reason);
    event WeekReleased(uint64 indexed week);
    event WeekExtended(uint64 indexed week, uint32 totalExtensionSeconds);
    event Finalized(
        uint64 indexed week, address indexed winner, bytes32 indexed sessionId, uint256 score, uint256 prize
    );
    event PrizeTransferFailed(uint64 indexed week, address indexed winner, uint256 amount);
    event PrizeClaimed(uint64 indexed week, address indexed winner, address to, uint256 amount);
    event UnclaimedRecycled(uint64 indexed week, uint64 indexed toWeek, uint256 amount);
    event RulesScheduled(
        uint64 indexed fromWeek,
        bytes32 seasonId,
        bytes32 altSeasonId,
        uint128 minPaidWei,
        uint64 maxSurvivalSeconds,
        uint256 maxScore,
        uint128 maxPrizeWei,
        uint128 minFundWei,
        bool adminClearOnly
    );
    event KeeperUpdated(address indexed keeper);
    event AdminTransferStarted(address indexed current, address indexed pending);
    event AdminTransferred(address indexed previous, address indexed current);
    event OperatorTransferStarted(address indexed current, address indexed pending);
    event OperatorTransferred(address indexed previous, address indexed current);
    event Paused(address by, bool isOperator);
    event Unpaused(address by, bool isOperator);
    event EndScheduled(uint64 lastWeek);
    event EndCancelled();
    event ResidualRecovered(address to, uint256 amount);
    event StraySwept(address indexed token, uint256 amount);
    event RefundedAfterEnd(uint64 indexed week, address indexed funder, uint256 amount);
    event ResidualRecipientNominated(address indexed current, address indexed nominee);
    event ResidualRecipientChanged(address indexed previous, address indexed current);

    // ---------------------------------------------------------------------
    // Roles (§A.3)
    // ---------------------------------------------------------------------

    // The checks live in functions so each modifier use costs a jump, not a copy of the revert code.
    modifier onlyOperator() {
        _onlyOperator();
        _;
    }

    modifier onlyAdmin() {
        _onlyAdmin();
        _;
    }

    function _onlyOperator() private view {
        _require(msg.sender == operator, "Only platform operator");
    }

    function _onlyAdmin() private view {
        _require(msg.sender == admin, "ONLY_ADMIN");
    }

    /// @param initial The first rules epoch; its fromWeek is set to `_firstWeek`.
    constructor(
        bytes32 _gameId,
        IERC20 _token,
        IRankedScoreReader _scoreRegistry,
        IRankedEntryReader _rankedEntry,
        uint64 _firstWeek,
        address _operator,
        address _admin,
        address _keeper,
        address _residualRecipient,
        Rules memory initial
    ) {
        _require(_gameId != bytes32(0), "EMPTY_GAME_ID");
        _require(
            address(_token) != address(0) && address(_scoreRegistry) != address(0)
                && address(_rankedEntry) != address(0) && _operator != address(0) && _admin != address(0)
                && _residualRecipient != address(0),
            "ZERO_ADDRESS"
        );
        // No run opened before this contract, its rules and its block list existed can ever win.
        _require(_firstWeek > currentWeek(), "BAD_WEEK");
        _requireValidRules(initial);
        gameId = _gameId;
        token = _token;
        scoreRegistry = _scoreRegistry;
        rankedEntry = _rankedEntry;
        firstWeek = _firstWeek;
        residualRecipient = _residualRecipient;
        operator = _operator;
        admin = _admin;
        keeper = _keeper;
        staffEver[_operator] = true;
        staffEver[_admin] = true;
        if (_keeper != address(0)) staffEver[_keeper] = true;
        emit OperatorTransferred(address(0), _operator);
        emit AdminTransferred(address(0), _admin);
        emit KeeperUpdated(_keeper);
        initial.fromWeek = _firstWeek;
        _rules.push(initial);
        _emitRules(initial);
    }

    function transferOperator(address newOperator) external onlyOperator {
        _require(newOperator != address(0), "ZERO_ADDRESS");
        pendingOperator = newOperator;
        emit OperatorTransferStarted(operator, newOperator);
    }

    function acceptOperator() external {
        _require(msg.sender == pendingOperator, "Only pending operator");
        address previous = operator;
        operator = msg.sender;
        pendingOperator = address(0);
        staffEver[msg.sender] = true;
        emit OperatorTransferred(previous, msg.sender);
    }

    /// @notice Two-step admin transfer, refused while the operator's pause is on.
    function transferAdmin(address newAdmin) external onlyAdmin {
        _require(!operatorPaused, "OPERATOR_LOCK");
        _require(newAdmin != address(0), "ZERO_ADDRESS");
        pendingAdmin = newAdmin;
        emit AdminTransferStarted(admin, newAdmin);
    }

    function acceptAdmin() external {
        _require(msg.sender == pendingAdmin, "ONLY_PENDING_ADMIN");
        _require(!operatorPaused, "OPERATOR_LOCK");
        address previous = admin;
        admin = msg.sender;
        pendingAdmin = address(0);
        staffEver[msg.sender] = true;
        emit AdminTransferred(previous, msg.sender);
    }

    /// @notice One-step, uncontestable admin replacement (emergency stop 5). Clears any pending admin.
    function forceAdmin(address newAdmin) external onlyOperator {
        _require(newAdmin != address(0), "ZERO_ADDRESS");
        address previous = admin;
        admin = newAdmin;
        pendingAdmin = address(0);
        staffEver[newAdmin] = true;
        emit AdminTransferred(previous, newAdmin);
    }

    /// @notice address(0) disables keeper powers. A new keeper becomes staffEver (it can never win).
    function setKeeper(address newKeeper) external onlyOperator {
        keeper = newKeeper;
        if (newKeeper != address(0)) staffEver[newKeeper] = true;
        emit KeeperUpdated(newKeeper);
    }

    function pause() external onlyAdmin {
        adminPaused = true;
        emit Paused(msg.sender, false);
    }

    function unpause() external onlyAdmin {
        adminPaused = false;
        emit Unpaused(msg.sender, false);
    }

    /// @notice The operator's own pause flag. The admin cannot clear it.
    function operatorPause() external onlyOperator {
        operatorPaused = true;
        emit Paused(msg.sender, true);
    }

    function operatorUnpause() external onlyOperator {
        operatorPaused = false;
        emit Unpaused(msg.sender, true);
    }

    /// @notice Stops payouts and keeper clears only; funding, submissions and claims continue.
    function paused() public view returns (bool) {
        return adminPaused || operatorPaused;
    }

    // ---------------------------------------------------------------------
    // Rules epochs (§A.5)
    // ---------------------------------------------------------------------

    /// @notice Schedules an epoch for a week that has not started. Every pending epoch at or after
    ///         r.fromWeek is replaced, so the rules of a started week can never change.
    function scheduleRules(Rules calldata r) external onlyOperator {
        uint64 current = currentWeek();
        _require(r.fromWeek > current, "RULES_NOT_FUTURE");
        _require(r.fromWeek <= current + MAX_FUND_AHEAD_WEEKS, "RULES_TOO_FAR");
        _require(r.fromWeek >= firstWeek, "BAD_WEEK");
        _requireValidRules(r);
        uint256 length = _rules.length;
        while (length > 0 && _rules[length - 1].fromWeek >= r.fromWeek) {
            _rules.pop();
            --length;
        }
        _rules.push(r);
        uint256 pending;
        for (uint256 i = length + 1; i > 0 && _rules[i - 1].fromWeek > current; --i) ++pending;
        _require(pending <= MAX_PENDING_EPOCHS, "TOO_MANY_EPOCHS");
        _emitRules(r);
    }

    function rulesFor(uint64 week) public view returns (Rules memory) {
        return _rules[_ruleIndex(week)];
    }

    function rulesCount() external view returns (uint256) {
        return _rules.length;
    }

    function rulesAt(uint256 index) external view returns (Rules memory) {
        return _rules[index];
    }

    // ---------------------------------------------------------------------
    // Funding (§A.6)
    // ---------------------------------------------------------------------

    /// @notice Funds `week` (the current week or up to 8 weeks ahead). Only the amount actually received
    ///         is credited, and it must reach the week's minFundWei.
    function fund(uint64 week, uint256 amount) external nonReentrant {
        _fund(week, amount);
    }

    function fundCurrent(uint256 amount) external nonReentrant {
        _fund(currentWeek(), amount);
    }

    function _fund(uint64 week, uint256 amount) private {
        uint64 current = currentWeek();
        _require(week >= firstWeek && week >= current && week <= current + MAX_FUND_AHEAD_WEEKS, "BAD_WEEK");
        _require(endAfterWeek == 0 || week <= endAfterWeek, "FUNDED_AFTER_END");
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = token.balanceOf(address(this)) - before;
        _require(received > 0, "NOTHING_RECEIVED");
        _require(received >= _rules[_ruleIndex(week)].minFundWei, "BELOW_MIN_FUND");
        _weeks[week].funded += received;
        fundedBy[week][msg.sender] += received;
        liabilities += received;
        emit Funded(week, msg.sender, received);
    }

    // ---------------------------------------------------------------------
    // Candidates (§A.7)
    // ---------------------------------------------------------------------

    /// @notice Proposes or challenges with a verified, paid Ranked session. Permissionless; allowed while paused.
    function submitCandidate(bytes32 sessionId) external nonReentrant {
        (bytes32 reason, uint64 week, Candidate memory candidate) = _check(sessionId, MODE_SUBMIT);
        if (reason != bytes32(0)) revert(_reasonString(reason));
        _insert(week, candidate, msg.sender);
    }

    /// @notice Runs every submitCandidate check (steps 1-7) without writing.
    function checkEligibility(bytes32 sessionId) external view returns (bool ok, uint64 week, string memory reason) {
        bytes32 code;
        (code, week,) = _check(sessionId, MODE_SUBMIT);
        ok = code == bytes32(0);
        reason = _reasonString(code);
    }

    // ---------------------------------------------------------------------
    // Review (§A.8)
    // ---------------------------------------------------------------------

    function clear(bytes32 sessionId) external {
        Review state = reviewOf[sessionId];
        if (msg.sender == admin) {
            _require(state != Review.Disqualified, "DISQUALIFIED");
            adminReviewed[sessionId] = true;
        } else {
            _require(msg.sender == keeper, "ONLY_KEEPER");
            _require(
                !adminReviewed[sessionId] && (state == Review.None || state == Review.Cleared), "REVIEW_LOCKED"
            );
            (uint64 week,) = _sessionWeek(sessionId);
            _require(!_rules[_ruleIndex(week)].adminClearOnly, "REVIEW_LOCKED");
            _require(!paused(), "PAUSED");
        }
        reviewOf[sessionId] = Review.Cleared;
        emit Cleared(sessionId, msg.sender);
    }

    function flag(bytes32 sessionId, bytes32 reason) external {
        bool byAdmin = msg.sender == admin;
        _require(byAdmin || msg.sender == keeper, "ONLY_KEEPER");
        Review state = reviewOf[sessionId];
        _require(state != Review.Disqualified, "DISQUALIFIED");
        if (byAdmin) {
            adminReviewed[sessionId] = true;
        } else {
            _require(
                !adminReviewed[sessionId] && (state == Review.None || state == Review.Cleared), "REVIEW_LOCKED"
            );
        }
        (uint64 week,) = _sessionWeek(sessionId);
        reviewOf[sessionId] = Review.Flagged;
        reviewReason[sessionId] = reason;
        emit Flagged(week, sessionId, reason, msg.sender);
    }

    /// @notice Allowed while the session's week is Open, even before the session is ever submitted.
    ///         With wholeWalletForWeek, the wallet's listed row (if any) is removed too.
    function disqualify(bytes32 sessionId, bool wholeWalletForWeek, bytes32 reason) external onlyAdmin {
        (uint64 week, address player) = _sessionWeek(sessionId);
        Week storage wk = _weeks[week];
        _require(wk.status == WeekStatus.Open, "WEEK_SETTLED");
        reviewOf[sessionId] = Review.Disqualified;
        reviewReason[sessionId] = reason;
        adminReviewed[sessionId] = true;
        if (wholeWalletForWeek) walletDisqualified[week][player] = true;
        Candidate[5] storage list = _candidates[week];
        uint256 n = wk.count;
        for (uint256 i; i < n; ++i) {
            if (list[i].sessionId == sessionId || (wholeWalletForWeek && list[i].player == player)) {
                bytes32 removed = list[i].sessionId;
                _removeAt(list, i, n);
                wk.count = uint8(n - 1);
                emit CandidateRemoved(week, removed, "disqualified");
                break;
            }
        }
        emit Disqualified(week, sessionId, player, wholeWalletForWeek, reason);
    }

    /// @notice Resets a session to None (still admin-reviewed) and clears its wallet's disqualification for
    ///         the week. Only a session that was listed before is re-inserted, and only if it still passes
    ///         checks 1-7 (the window check excepted).
    function reinstate(bytes32 sessionId) external onlyAdmin {
        (uint64 week, address player) = _sessionWeek(sessionId);
        Week storage wk = _weeks[week];
        _require(wk.status == WeekStatus.Open, "WEEK_SETTLED");
        _require(block.timestamp < _payoutAt(week) || wk.held, "TOO_LATE");
        reviewOf[sessionId] = Review.None;
        reviewReason[sessionId] = bytes32(0);
        adminReviewed[sessionId] = true;
        walletDisqualified[week][player] = false;
        emit Reinstated(week, sessionId);
        if (wasListed[sessionId]) {
            (bytes32 reason,, Candidate memory candidate) = _check(sessionId, MODE_REINSTATE);
            if (reason == bytes32(0)) _insert(week, candidate, msg.sender);
        }
    }

    /// @notice Refills a list that disqualifications left short. It can never displace a row.
    function adminSubmit(bytes32 sessionId) external onlyAdmin nonReentrant {
        (bytes32 reason, uint64 week, Candidate memory candidate) = _check(sessionId, MODE_ADMIN);
        if (reason != bytes32(0)) revert(_reasonString(reason));
        _insert(week, candidate, msg.sender);
    }

    function setBlocked(address wallet, bool isBlocked, bytes32 reason) external onlyAdmin {
        _require(wallet != address(0), "ZERO_ADDRESS");
        blocked[wallet] = isBlocked;
        emit WalletBlocked(wallet, isBlocked, reason);
    }

    function holdWeek(uint64 week, bytes32 reason) external onlyAdmin {
        _require(_weeks[week].status == WeekStatus.Open, "WEEK_SETTLED");
        _weeks[week].held = true;
        emit WeekHeld(week, reason);
    }

    function releaseWeek(uint64 week) external onlyAdmin {
        _weeks[week].held = false;
        emit WeekReleased(week);
    }

    /// @notice Shifts the settle cutoff, the candidate window and the payout time together (<= 72 h in total).
    function extendWeek(uint64 week, uint32 extraSeconds) external onlyAdmin {
        Week storage wk = _weeks[week];
        _require(block.timestamp < _payoutAt(week), "TOO_LATE");
        uint256 total = uint256(wk.extension) + extraSeconds;
        _require(total <= MAX_EXTENSION, "EXTENSION_CAP");
        wk.extension = uint32(total);
        emit WeekExtended(week, uint32(total));
    }

    // ---------------------------------------------------------------------
    // Finalize, claim, recycle (§A.9)
    // ---------------------------------------------------------------------

    function finalize(uint64 week) external nonReentrant {
        _require(week >= firstWeek, "BAD_WEEK");
        // A week after a scheduled end only holds refundable funding; it never finalizes.
        _require(endAfterWeek == 0 || week <= endAfterWeek, "AFTER_END");
        Week storage wk = _weeks[week];
        _require(wk.status == WeekStatus.Open, "WEEK_SETTLED");
        _require(block.timestamp >= _payoutAt(week), "PAYOUT_NOT_DUE");
        _require(!paused(), "PAUSED");
        _require(!wk.held, "WEEK_HELD");
        uint256 pot = wk.funded + wk.carriedIn;
        wk.finalizedAt = uint64(block.timestamp);
        if (pot == 0) {
            // Unfunded weeks have no champion, whatever the candidates.
            wk.status = WeekStatus.RolledOver;
            emit Finalized(week, address(0), bytes32(0), 0, 0);
            return;
        }
        Candidate[5] storage list = _candidates[week];
        uint256 n = wk.count;
        uint256 i;
        for (; i < n; ++i) {
            bytes32 skip = _skipReason(week, list[i]);
            if (skip == bytes32(0)) break;
            emit CandidateSkipped(week, list[i].sessionId, skip);
        }
        if (i == n) {
            wk.status = WeekStatus.RolledOver;
            uint64 target = _carry(pot);
            emit Finalized(week, address(0), bytes32(0), 0, 0);
            emit RolledOver(week, target, pot);
            return;
        }
        Candidate memory leader = list[i];
        _require(reviewOf[leader.sessionId] == Review.Cleared, "LEADER_NOT_CLEARED");
        uint256 cap = _rules[_ruleIndex(week)].maxPrizeWei;
        uint256 prize = cap != 0 && pot > cap ? cap : pot;
        wk.status = WeekStatus.Paid;
        wk.winner = leader.player;
        wk.winningSession = leader.sessionId;
        wk.prize = prize;
        wk.unclaimed = prize;
        if (pot > prize) {
            uint64 target = _carry(pot - prize);
            emit CapExcessCarried(week, target, pot - prize);
        }
        emit Finalized(week, leader.player, leader.sessionId, leader.score, prize);
        if (token.trySafeTransfer(leader.player, prize)) {
            wk.unclaimed = 0;
            liabilities -= prize;
        } else {
            emit PrizeTransferFailed(week, leader.player, prize);
        }
    }

    /// @notice Pull claim of a prize whose transfer failed at finalize, to any address the winner chooses.
    function claim(uint64 week, address to) external nonReentrant {
        Week storage wk = _weeks[week];
        _require(msg.sender == wk.winner, "ONLY_WINNER");
        _require(to != address(0), "ZERO_ADDRESS");
        uint256 amount = wk.unclaimed;
        _require(amount > 0, "NOTHING_TO_CLAIM");
        wk.unclaimed = 0;
        liabilities -= amount;
        token.safeTransfer(to, amount);
        emit PrizeClaimed(week, msg.sender, to, amount);
    }

    /// @notice After 180 days an unclaimed prize returns to the prize pool (the current week), never to staff.
    function recycleUnclaimed(uint64 week) external nonReentrant {
        Week storage wk = _weeks[week];
        uint256 amount = wk.unclaimed;
        _require(amount > 0, "NOTHING_TO_CLAIM");
        _require(block.timestamp >= uint256(wk.finalizedAt) + UNCLAIMED_AFTER, "TOO_EARLY");
        wk.unclaimed = 0;
        uint64 target = _carry(amount);
        emit UnclaimedRecycled(week, target, amount);
    }

    // ---------------------------------------------------------------------
    // End of life, residue and stray tokens (§A.10)
    // ---------------------------------------------------------------------

    /// @notice At least one full week's notice; no funding can block it.
    function scheduleEnd(uint64 lastWeek) external onlyOperator {
        uint64 current = currentWeek();
        _require(lastWeek > current, "END_TOO_SOON");
        _require(endAfterWeek == 0 || current <= endAfterWeek, "END_FINAL");
        endAfterWeek = lastWeek;
        emit EndScheduled(lastWeek);
    }

    function cancelEnd() external onlyOperator {
        _require(endAfterWeek != 0 && currentWeek() <= endAfterWeek, "END_FINAL");
        endAfterWeek = 0;
        emit EndCancelled();
    }

    /// @notice A funder recovers its own funding of a week after a scheduled end that can no longer be cancelled.
    function refundAfterEnd(uint64 week) external nonReentrant {
        uint64 end = endAfterWeek;
        _require(end != 0 && week > end && currentWeek() > end, "NOT_AFTER_END");
        uint256 amount = fundedBy[week][msg.sender];
        _require(amount > 0, "NOTHING_TO_REFUND");
        fundedBy[week][msg.sender] = 0;
        _weeks[week].funded -= amount;
        liabilities -= amount;
        token.safeTransfer(msg.sender, amount);
        emit RefundedAfterEnd(week, msg.sender, amount);
    }

    /// @notice Sends the residue (a final pot nobody won) to the residual recipient, 30 days after the last deposit.
    function recoverResidual() external onlyOperator nonReentrant {
        uint256 amount = residual;
        _require(amount > 0 && block.timestamp >= residualAvailableAt, "TOO_EARLY");
        residual = 0;
        liabilities -= amount;
        address to = residualRecipient;
        token.safeTransfer(to, amount);
        _require(token.balanceOf(address(this)) >= liabilities, "LIABILITIES_BREACHED");
        emit ResidualRecovered(to, amount);
    }

    /// @notice Only the current residual recipient nominates its successor (two-step).
    function nominateResidualRecipient(address nominee) external {
        _require(msg.sender == residualRecipient, "ONLY_RESIDUAL_RECIPIENT");
        _require(nominee != address(0), "ZERO_ADDRESS");
        pendingResidualRecipient = nominee;
        emit ResidualRecipientNominated(msg.sender, nominee);
    }

    function acceptResidualRecipient() external {
        _require(msg.sender == pendingResidualRecipient, "ONLY_RESIDUAL_RECIPIENT");
        address previous = residualRecipient;
        residualRecipient = msg.sender;
        pendingResidualRecipient = address(0);
        emit ResidualRecipientChanged(previous, msg.sender);
    }

    /// @notice Sends tokens nobody is owed to the residual recipient: for the prize token only the balance
    ///         above liabilities, for any other token the whole balance. Post-condition for any token:
    ///         the prize-token balance still covers liabilities (double entry points, sender fees).
    function sweepStray(address strayToken) external onlyOperator nonReentrant {
        _require(strayToken != address(0), "ZERO_ADDRESS");
        uint256 amount;
        if (strayToken == address(token)) {
            uint256 balance = token.balanceOf(address(this));
            amount = balance > liabilities ? balance - liabilities : 0;
        } else {
            amount = IERC20(strayToken).balanceOf(address(this));
        }
        if (amount > 0) IERC20(strayToken).safeTransfer(residualRecipient, amount);
        _require(token.balanceOf(address(this)) >= liabilities, "LIABILITIES_BREACHED");
        emit StraySwept(strayToken, amount);
    }

    // ---------------------------------------------------------------------
    // Views (§A.14)
    // ---------------------------------------------------------------------

    function weekOf(uint64 ts) public pure returns (uint64) {
        return (ts + WEEK_SHIFT) / WEEK;
    }

    function currentWeek() public view returns (uint64) {
        return weekOf(uint64(block.timestamp));
    }

    /// @notice (start, close) of the calendar week; the other three include the admin extension.
    function weekBounds(uint64 week)
        external
        view
        returns (uint64 start, uint64 close, uint64 settleCutoff, uint64 candidateUntil, uint64 payoutAt)
    {
        close = uint64(_close(week));
        start = close - WEEK;
        uint64 shifted = close + _weeks[week].extension;
        settleCutoff = shifted + SETTLE_GRACE;
        candidateUntil = shifted + CANDIDATE_WINDOW;
        payoutAt = shifted + PAYOUT_DELAY;
    }

    function potOf(uint64 week) external view returns (uint256 funded, uint256 carriedIn, uint256 total) {
        Week storage wk = _weeks[week];
        return (wk.funded, wk.carriedIn, wk.funded + wk.carriedIn);
    }

    function weekState(uint64 week)
        external
        view
        returns (
            WeekStatus status,
            bool held,
            uint8 count,
            address winner,
            bytes32 winningSession,
            uint256 prize,
            uint256 unclaimed,
            uint64 finalizedAt,
            uint32 extension
        )
    {
        Week storage wk = _weeks[week];
        return (
            wk.status, wk.held, wk.count, wk.winner, wk.winningSession, wk.prize, wk.unclaimed, wk.finalizedAt,
            wk.extension
        );
    }

    function candidatesOf(uint64 week) external view returns (Candidate[] memory list) {
        uint256 n = _weeks[week].count;
        list = new Candidate[](n);
        for (uint256 i; i < n; ++i) list[i] = _candidates[week][i];
    }

    /// @notice The candidate finalize would pay, with the same skip rules (no events). Zeros when none.
    function leaderOf(uint64 week)
        external
        view
        returns (bytes32 sessionId, address player, uint256 score, Review review)
    {
        uint256 n = _weeks[week].count;
        for (uint256 i; i < n; ++i) {
            Candidate storage c = _candidates[week][i];
            if (_skipReason(week, c) == bytes32(0)) return (c.sessionId, c.player, c.score, reviewOf[c.sessionId]);
        }
    }

    // ---------------------------------------------------------------------
    // Internals
    // ---------------------------------------------------------------------

    function _close(uint64 week) private pure returns (uint256) {
        return uint256(week) * WEEK + (WEEK - WEEK_SHIFT);
    }

    function _payoutAt(uint64 week) private view returns (uint256) {
        return _close(week) + _weeks[week].extension + PAYOUT_DELAY;
    }

    /// @dev The last epoch with fromWeek <= week (binary search; epoch 0 for earlier weeks).
    function _ruleIndex(uint64 week) private view returns (uint256) {
        uint256 lo;
        uint256 hi = _rules.length;
        while (lo < hi) {
            uint256 mid = (lo + hi) / 2;
            if (_rules[mid].fromWeek <= week) lo = mid + 1;
            else hi = mid;
        }
        return lo == 0 ? 0 : lo - 1;
    }

    function _requireValidRules(Rules memory r) private pure {
        _require(r.seasonId != bytes32(0) && r.minFundWei > 0, "BAD_RULES");
    }

    function _emitRules(Rules memory r) private {
        emit RulesScheduled(
            r.fromWeek,
            r.seasonId,
            r.altSeasonId,
            r.minPaidWei,
            r.maxSurvivalSeconds,
            r.maxScore,
            r.maxPrizeWei,
            r.minFundWei,
            r.adminClearOnly
        );
    }

    /// @dev The week and payer of a paid session (its week is weekOf(openedAt), as on the board).
    function _sessionWeek(bytes32 sessionId) private view returns (uint64, address) {
        IRankedEntryReader.PaidSession memory paid = rankedEntry.getPaidSession(sessionId);
        _require(paid.exists, "NOT_PAID");
        return (weekOf(paid.openedAt), paid.player);
    }

    /// @dev Moves `amount` into the current week, or into `residual` after a scheduled end (toWeek 0).
    function _carry(uint256 amount) private returns (uint64 target) {
        target = currentWeek();
        uint64 end = endAfterWeek;
        if (end != 0 && target > end) {
            residual += amount;
            residualAvailableAt = uint64(block.timestamp + RESIDUAL_DELAY);
            return 0;
        }
        _weeks[target].carriedIn += amount;
    }

    function _skipReason(uint64 week, Candidate storage c) private view returns (bytes32) {
        address player = c.player;
        if (blocked[player]) return "blocked";
        if (walletDisqualified[week][player]) return "disqualified-wallet";
        if (staffEver[player]) return "staff";
        if (reviewOf[c.sessionId] == Review.Disqualified) return "disqualified";
        return bytes32(0);
    }

    /// @dev Board order: score DESC, submittedAt ASC, sessionId ASC (bytes32 order = lowercase-hex order).
    function _ranksAbove(Candidate memory a, Candidate storage b) private view returns (bool) {
        if (a.score != b.score) return a.score > b.score;
        if (a.submittedAt != b.submittedAt) return a.submittedAt < b.submittedAt;
        return uint256(a.sessionId) < uint256(b.sessionId);
    }

    /// @dev Steps 1-7 of §A.7 in order. Returns the revert string as a bytes32 code (0 when eligible), the week and the row.
    function _check(bytes32 sessionId, uint8 mode) private view returns (bytes32, uint64, Candidate memory) {
        (bytes32 reason, uint64 week, Candidate memory candidate) = _checkRun(sessionId);
        if (reason == bytes32(0)) reason = _checkWeek(week, candidate, mode);
        return (reason, week, candidate);
    }

    /// @dev Steps 1-4: the run itself (registries, week, rules).
    function _checkRun(bytes32 sessionId) private view returns (bytes32, uint64 week, Candidate memory c) {
        IRankedScoreReader.ScoreRecord memory rec = scoreRegistry.getSession(sessionId);
        if (!rec.exists) return ("NOT_FOUND", 0, c);
        if (!rec.verified) return ("NOT_VERIFIED", 0, c);
        if (rec.gameId != gameId) return ("WRONG_GAME", 0, c);
        IRankedEntryReader.PaidSession memory paid = rankedEntry.getPaidSession(sessionId);
        // Mandatory: settlement skips isPaid when the entry fee is 0, and zero-amount sessions exist.
        if (!paid.exists || paid.player != rec.player || paid.gameId != gameId) return ("NOT_PAID", 0, c);
        week = weekOf(paid.openedAt);
        if (week < firstWeek) return ("BEFORE_FIRST_WEEK", week, c);
        if (endAfterWeek != 0 && week > endAfterWeek) return ("AFTER_END", week, c);
        Rules storage r = _rules[_ruleIndex(week)];
        if (paid.amountWei < r.minPaidWei) return ("BELOW_MIN_PAID", week, c);
        if (rec.seasonId != r.seasonId && (r.altSeasonId == bytes32(0) || rec.seasonId != r.altSeasonId)) {
            return ("WRONG_SEASON", week, c);
        }
        if (r.maxSurvivalSeconds != 0 && rec.survivalSeconds > r.maxSurvivalSeconds) return ("SURVIVAL_CAP", week, c);
        if ((r.maxScore != 0 && rec.score > r.maxScore) || rec.score > type(uint64).max) {
            return ("SCORE_CAP", week, c);
        }
        if (rec.score == 0) return ("ZERO_SCORE", week, c);
        c = Candidate(sessionId, rec.player, rec.submittedAt, uint64(rec.score));
        return (bytes32(0), week, c);
    }

    /// @dev Steps 5-7: timing, the player, and the list.
    function _checkWeek(uint64 week, Candidate memory c, uint8 mode) private view returns (bytes32) {
        Week storage wk = _weeks[week];
        uint256 shiftedClose = _close(week) + wk.extension;
        if (c.submittedAt > shiftedClose + SETTLE_GRACE) return "SETTLED_LATE";
        if (
            mode == MODE_SUBMIT && block.timestamp >= shiftedClose + CANDIDATE_WINDOW
                && !(wasListed[c.sessionId] && block.timestamp + RELIST_MARGIN < shiftedClose + PAYOUT_DELAY)
        ) return "WINDOW_CLOSED";
        if (wk.status != WeekStatus.Open) return "WEEK_SETTLED";
        if (mode == MODE_ADMIN) {
            if (wk.count >= MAX_CANDIDATES) return "LIST_FULL";
            if (block.timestamp >= shiftedClose + PAYOUT_DELAY && !wk.held) return "TOO_LATE";
        }
        if (staffEver[c.player]) return "STAFF_WALLET";
        if (blocked[c.player]) return "WALLET_BLOCKED";
        if (walletDisqualified[week][c.player] || reviewOf[c.sessionId] == Review.Disqualified) return "DISQUALIFIED";
        Candidate[5] storage list = _candidates[week];
        uint256 n = wk.count;
        bool sameWallet;
        for (uint256 i; i < n; ++i) {
            if (list[i].sessionId == c.sessionId) return "ALREADY_CANDIDATE";
            if (list[i].player == c.player) {
                if (!_ranksAbove(c, list[i])) return "NOT_BETTER";
                sameWallet = true;
            }
        }
        if (!sameWallet && n == MAX_CANDIDATES && !_ranksAbove(c, list[n - 1])) return "NOT_IN_TOP";
        return bytes32(0);
    }

    /// @dev Step 7 and 8: replace the wallet's worse row or drop the last row of a full list, insert in board
    ///      order, and emit. A displaced or replaced row keeps its review state and wasListed.
    function _insert(uint64 week, Candidate memory c, address submitter) private {
        Week storage wk = _weeks[week];
        Candidate[5] storage list = _candidates[week];
        uint256 n = wk.count;
        bytes32 previousLeader = n == 0 ? bytes32(0) : list[0].sessionId;
        uint256 i;
        while (i < n && list[i].player != c.player) ++i;
        if (i < n) {
            bytes32 replaced = list[i].sessionId;
            _removeAt(list, i, n);
            --n;
            emit CandidateRemoved(week, replaced, "replaced");
        } else if (n == MAX_CANDIDATES) {
            --n;
            emit CandidateRemoved(week, list[n].sessionId, "displaced");
        }
        uint256 pos = n;
        while (pos > 0 && _ranksAbove(c, list[pos - 1])) {
            list[pos] = list[pos - 1];
            --pos;
        }
        list[pos] = c;
        wk.count = uint8(n + 1);
        wasListed[c.sessionId] = true;
        emit CandidateSubmitted(week, c.sessionId, c.player, c.score, c.submittedAt, submitter, uint8(pos + 1));
        if (list[0].sessionId != previousLeader) emit LeaderChanged(week, list[0].sessionId, list[0].player, list[0].score);
    }

    /// @dev Every revert goes through here with a bytes32 code, so the revert encoding exists once in the
    ///      bytecode. The revert data is the standard Error(string) of require(cond, "CODE").
    function _require(bool ok, bytes32 code) private pure {
        if (!ok) revert(_reasonString(code));
    }

    /// @dev A bytes32 reason code (left-aligned ASCII, as ethers.encodeBytes32String) as a string. Codes keep the
    ///      eligibility checks compact; submitCandidate and adminSubmit revert with the same Error(string).
    function _reasonString(bytes32 code) private pure returns (string memory text) {
        uint256 length;
        while (length < 32 && code[length] != 0) ++length;
        text = new string(length);
        if (length > 0) {
            assembly ("memory-safe") {
                mstore(add(text, 32), code)
            }
        }
    }

    function _removeAt(Candidate[5] storage list, uint256 index, uint256 n) private {
        for (uint256 j = index; j + 1 < n; ++j) list[j] = list[j + 1];
        delete list[n - 1];
    }
}
