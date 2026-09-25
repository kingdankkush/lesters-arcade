// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IRankedScoreReader, IRankedEntryReader} from "../../src/interfaces/IRankedReaders.sol";

/// @notice TEST MOCK ONLY (tests/weekly-jackpot-contract.test.mjs). Stands in for BOTH deployed Ranked
///         readers with settable records, for states the real 1.8.x contracts never produce (for example
///         `verified == false`: ScoreSubmissionRegistry always stores verified runs).
contract MockRankedReaders {
    mapping(bytes32 => IRankedScoreReader.ScoreRecord) private _sessions;
    mapping(bytes32 => IRankedEntryReader.PaidSession) private _paid;

    function setSession(IRankedScoreReader.ScoreRecord calldata record) external {
        _sessions[record.sessionId] = record;
    }

    function setPaidSession(bytes32 sessionId, IRankedEntryReader.PaidSession calldata paid) external {
        _paid[sessionId] = paid;
    }

    function getSession(bytes32 sessionId) external view returns (IRankedScoreReader.ScoreRecord memory) {
        return _sessions[sessionId];
    }

    function getPaidSession(bytes32 sessionId) external view returns (IRankedEntryReader.PaidSession memory) {
        return _paid[sessionId];
    }
}
