// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ITimelock} from "./interface/ITimelock.sol";
import {IVoteToken} from "./interface/IVoteToken.sol";

contract Pauser is UpgradeableClaimable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // @notice The duration of voting on emergency pause
    uint256 public votingPeriod;

    // @notice The address of the TrustToken Protocol Timelock
    ITimelock public timelock;

    // @notice The address of the TrustToken governance token
    IVoteToken public trustToken;

    // @notice The address of the stkTRU voting token
    IVoteToken public stkTRU;

    // @notice The total number of requests
    uint256 public requestCount;

    // @notice The official record of all requests ever proposed
    mapping(uint256 => PauseRequest) public requests;

    // ======= STORAGE DECLARATION END ============

    // @notice The name of this contract
    string public constant name = "TrueFi Pauser";

    struct PauseRequest {
        // @notice Unique id for looking up a request
        uint256 id;
        // @notice Creator of the request
        address requester;
        // @notice The timestamp that the request will be available for execution, set once the vote succeeds
        uint256 eta;
        // @notice the ordered list of target addresses of contracts to be paused
        address[] targets;
        // @notice The ordered list of function signatures to be called by the
        // different types of proxies might require different types of pause functions
        string[] signatures;
        // @notice The block at which voting begins: holders must delegate their votes prior to this block
        uint256 startBlock;
        // @notice The block at which voting ends: votes must be cast prior to this block
        uint256 endBlock;
        // @notice Current number of votes in favor of this request
        uint256 forVotes;
        // @notice Flag marking whether the request has been canceled
        bool canceled;
        // @notice Flag marking whether the request has been executed
        bool executed;
        // @notice Receipts of ballots for the entire set of voters
        mapping(address => bool) receipts;
    }

    // @notice Ballot receipt record for a voter
    struct Receipt {
        // @notice Whether or not a vote has been cast
        bool hasVoted;
        // @notice The number of votes the voter had, which were cast
        uint96 votes;
    }

    // @notice Possible states that a request may be in
    enum RequestState {Pending, Active, Canceled, Succeeded, Expired, Executed}

    // @notice The number of votes in support of a request required in order for a quorum to be reached and for a vote to succeed
    function quorumVotes() public pure returns (uint256) {
        return 50000000e8;
    } // 50,000,000 Tru

    // @notice The number of votes required in order for a voter to become a requester
    function requestThreshold() public pure returns (uint256) {
        return 100000e8;
    } // 100,000 TRU

    // @notice The maximum number of actions that can be included in a request
    function requestMaxOperations() public pure returns (uint256) {
        return 10;
    } // 10 actions

    /**
     * @dev Initialize sets initial contract variables
     */
    function initialize(
        ITimelock _timelock,
        IVoteToken _trustToken,
        IVoteToken _stkTRU,
        uint256 _votingPeriod
    ) external {
        UpgradeableClaimable.initialize(msg.sender);
        timelock = _timelock;
        trustToken = _trustToken;
        stkTRU = _stkTRU;
        votingPeriod = _votingPeriod;
    }

    /**
     * @dev Get the request state for the specified request
     * @param requestId ID of a request in which to get its state
     * @return Enumerated type of RequestState
     */
    function state(uint256 requestId) public view returns (RequestState) {
        require(requestCount >= requestId && requestId > 0, "Pauser: invalid request id");
        PauseRequest storage request = requests[requestId];
        if (request.canceled) {
            return RequestState.Canceled;
        } else if (block.number <= request.startBlock) {
            return RequestState.Pending;
        } else if (block.number <= request.endBlock) {
            return RequestState.Active;
        } else if (request.eta == 0) {
            return RequestState.Succeeded;
        } else if (request.executed) {
            return RequestState.Executed;
        } else if (block.timestamp >= add256(request.eta, timelock.GRACE_PERIOD())) {
            return RequestState.Expired;
        }
    }

    /**
     * @dev safe addition function for uint256
     */
    function add256(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "addition overflow");
        return c;
    }

    /**
     * @dev Count the total PriorVotes from TRU and stkTRU
     * @param account The address to check the total votes
     * @param blockNumber The block number at which the getPriorVotes() check
     * @return The sum of PriorVotes from TRU and stkTRU
     */
    function countVotes(address account, uint256 blockNumber) public view returns (uint96) {
        uint96 truVote = trustToken.getPriorVotes(account, blockNumber);
        uint96 stkTRUVote = stkTRU.getPriorVotes(account, blockNumber);
        uint96 totalVote = add96(truVote, stkTRUVote, "GovernorAlpha: countVotes addition overflow");
        return totalVote;
    }

    /**
     * @dev safe96 add function
     * @return a + b
     */
    function add96(
        uint96 a,
        uint96 b,
        string memory errorMessage
    ) internal pure returns (uint96) {
        uint96 c = a + b;
        require(c >= a, errorMessage);
        return c;
    }

    /**
     * @dev safe subtraction function for uint256
     */
    function sub256(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "subtraction underflow");
        return a - b;
    }
}
