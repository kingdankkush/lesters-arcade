// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @title AchievementRegistry
/// @author Lester's Arcade Core
/// @notice Soulbound ERC-721 achievements bound to the player's wallet. The operator defines
///         achievements; approved minters (ScoreSubmissionRegistry) mint them during verified
///         settlement. Tokens cannot be transferred between wallets (ERC-5192 "locked").
/// @dev    tokenId = uint256(keccak256(abi.encode(player, achievementId))) so a wallet can hold at
///         most one token per achievement and the id is derivable off chain without an indexer.
contract AchievementRegistry is ERC721 {
    struct Achievement {
        bytes32 id;
        bytes32 gameId;
        string title;
        string category;
        string tokenUriPath;
        bool exists;
    }

    /// @dev ERC-5192 (Minimal Soulbound NFTs) interface id.
    bytes4 private constant ERC5192_INTERFACE_ID = 0xb45a3c0e;

    address public operator;
    address public pendingOperator;
    string public baseTokenUri;

    mapping(address => bool) public minters;
    mapping(bytes32 => Achievement) public achievements;
    bytes32[] private _achievementIds;
    mapping(address => mapping(bytes32 => uint256)) public unlockedAt;
    mapping(uint256 => bytes32) public tokenAchievement;

    error Soulbound();

    event AchievementDefined(bytes32 indexed id, bytes32 indexed gameId, string title, string category, string tokenUriPath);
    event AchievementUnlocked(address indexed wallet, bytes32 indexed achievementId, bytes32 indexed sessionId, uint256 tokenId);
    event AchievementRevoked(uint256 indexed tokenId, address indexed wallet, bytes32 indexed achievementId, string reason);
    event MinterUpdated(address indexed minter, bool allowed);
    event BaseTokenUriUpdated(string baseTokenUri);
    event OperatorTransferStarted(address indexed currentOperator, address indexed pendingOperator);
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);
    /// @dev ERC-5192 events.
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    modifier onlyOperator() {
        require(msg.sender == operator, "Only platform operator");
        _;
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Only minter");
        _;
    }

    constructor(address _operator, string memory _baseTokenUri) ERC721("Lester's Arcade Achievements", "LAACH") {
        require(_operator != address(0), "Invalid operator");
        operator = _operator;
        baseTokenUri = _baseTokenUri;
    }

    // ---------------------------------------------------------------------
    // Operator administration
    // ---------------------------------------------------------------------

    function setMinter(address minter, bool allowed) external onlyOperator {
        require(minter != address(0), "Invalid minter");
        minters[minter] = allowed;
        emit MinterUpdated(minter, allowed);
    }

    function setBaseTokenUri(string calldata _baseTokenUri) external onlyOperator {
        baseTokenUri = _baseTokenUri;
        emit BaseTokenUriUpdated(_baseTokenUri);
    }

    /// @notice Define or update an achievement. Idempotent: re-defining an existing id updates metadata.
    function defineAchievement(
        bytes32 id,
        bytes32 gameId,
        string calldata title,
        string calldata category,
        string calldata tokenUriPath
    ) external onlyOperator {
        require(id != bytes32(0), "EMPTY_ACHIEVEMENT_ID");
        Achievement storage achievement = achievements[id];
        if (!achievement.exists) {
            _achievementIds.push(id);
        }
        achievement.id = id;
        achievement.gameId = gameId;
        achievement.title = title;
        achievement.category = category;
        achievement.tokenUriPath = tokenUriPath;
        achievement.exists = true;
        emit AchievementDefined(id, gameId, title, category, tokenUriPath);
    }

    function transferOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "Invalid operator");
        pendingOperator = newOperator;
        emit OperatorTransferStarted(operator, newOperator);
    }

    function acceptOperator() external {
        require(msg.sender == pendingOperator, "Only pending operator");
        address previous = operator;
        operator = pendingOperator;
        pendingOperator = address(0);
        emit OperatorTransferred(previous, operator);
    }

    // ---------------------------------------------------------------------
    // Minting / burning
    // ---------------------------------------------------------------------

    /// @notice Mint the soulbound token for `player`. Never reverts for an undefined or already-held
    ///         achievement so a verified score settlement is not blocked by achievement state.
    /// @dev Uses _mint (no onERC721Received callback) so settlement cannot be re-entered by a
    ///      contract-wallet receiver.
    function mintFor(address player, bytes32 achievementId, bytes32 sessionId) external onlyMinter returns (bool minted) {
        if (player == address(0)) return false;
        if (!achievements[achievementId].exists) return false;
        if (unlockedAt[player][achievementId] != 0) return false;

        uint256 tokenId = tokenIdFor(player, achievementId);
        if (_ownerOf(tokenId) != address(0)) return false;

        unlockedAt[player][achievementId] = block.timestamp;
        tokenAchievement[tokenId] = achievementId;
        _mint(player, tokenId);
        emit Locked(tokenId);
        emit AchievementUnlocked(player, achievementId, sessionId, tokenId);
        return true;
    }

    /// @notice Burn your own achievement token.
    function burn(uint256 tokenId) external {
        require(_requireOwned(tokenId) == msg.sender, "Only token owner");
        _burnAchievement(tokenId);
    }

    /// @notice Operator revocation (e.g. a run later found fraudulent).
    function revoke(uint256 tokenId, string calldata reason) external onlyOperator {
        address wallet = _requireOwned(tokenId);
        bytes32 achievementId = tokenAchievement[tokenId];
        _burnAchievement(tokenId);
        emit AchievementRevoked(tokenId, wallet, achievementId, reason);
    }

    function _burnAchievement(uint256 tokenId) private {
        address wallet = _ownerOf(tokenId);
        bytes32 achievementId = tokenAchievement[tokenId];
        delete unlockedAt[wallet][achievementId];
        delete tokenAchievement[tokenId];
        _burn(tokenId);
    }

    /// @dev Soulbound: only mint (from == 0) and burn (to == 0) are allowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice ERC-5192: every existing achievement token is permanently locked.
    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        return interfaceId == ERC5192_INTERFACE_ID || super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(baseTokenUri, achievements[tokenAchievement[tokenId]].tokenUriPath);
    }

    function hasUnlocked(address wallet, bytes32 achievementId) external view returns (bool) {
        return unlockedAt[wallet][achievementId] != 0;
    }

    function tokenIdFor(address wallet, bytes32 achievementId) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(wallet, achievementId)));
    }

    function achievementIds() external view returns (bytes32[] memory) {
        return _achievementIds;
    }

    function achievementCount() external view returns (uint256) {
        return _achievementIds.length;
    }

    function getAchievement(bytes32 id) external view returns (Achievement memory) {
        return achievements[id];
    }
}
