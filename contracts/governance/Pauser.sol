// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ITimelock} from "./interface/ITimelock.sol";
import {IVoteToken} from "./interface/IVoteToken.sol";
import {IOwnedUpgradeabilityProxy} from "../proxy/interface/IOwnedUpgradeabilityProxy.sol";
import {ImplementationReference} from "../proxy/ImplementationReference.sol";
import {IPauseableContract} from "../common/interface/IPauseableContract.sol";

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

    // @notice The address of the TrustToken Protocol Governor
    IOwnedUpgradeabilityProxy public governor;

    // @notice The address of the TrustToken governance token
    IVoteToken public trustToken;

    // @notice The address of the stkTRU voting token
    IVoteToken public stkTRU;

    // @notice The total number of requests
    uint256 public requestCount;

    // @notice The official record of all requests ever proposed
    mapping(uint256 => PauseRequest) public requests;

    // @notice The latest request for each requester
    mapping(address => uint256) public latestRequestIds;

    // ======= STORAGE DECLARATION END ============

    // @notice The name of this contract
    string public constant name = "TrueFi Pauser";

    // @notice Time in seconds, which corresponds to a period of time,
    // that a request is available for execution after successful voting
    uint256 public constant EXECUTION_PERIOD = 1 days;

    struct PauseRequest {
        // @notice Unique id for looking up a request
        uint256 id;
        // @notice Creator of the request
        address requester;
        // @notice the ordered list of target addresses of contracts to be paused
        address[] targets;
        // @notice The ordered list of functions to be called
        // different types of proxies might require different types of pause functions
        PausingMethod[] methods;
        // @notice The block number at which voting begins: holders must delegate their votes prior to this block
        uint256 startBlock;
        // @notice The timestamp at which voting ends: votes must be cast prior to this timestamp
        uint256 endTime;
        // @notice Current number of votes in favor of this request
        uint256 votes;
        // @notice Flag marking whether the request has been executed
        bool executed;
        // @notice Receipts of ballots for the entire set of voters
        mapping(address => Receipt) receipts;
    }

    // @notice Ballot receipt record for a voter
    struct Receipt {
        // @notice Whether or not a vote has been cast
        bool hasVoted;
        // @notice The number of votes the voter had, which were cast
        uint96 votes;
    }

    // @notice Possible pausing mechanisms
    enum PausingMethod {
        Status,
        Proxy,
        Reference
    }

    // @notice Possible states that a request may be in
    enum RequestState {
        Active,
        Succeeded,
        Defeated,
        Expired,
        Executed
    }

    // @notice An event emitted when a request has been executed in the Timelock
    event RequestExecuted(uint256 id);

    // @notice An event emitted when a vote has been cast on a request
    event VoteCast(address voter, uint256 requestId, uint256 votes);

    // @notice An event emitted when a new request is created
    event RequestCreated(
        uint256 id,
        address requester,
        address[] targets,
        PausingMethod[] methods,
        uint256 startBlock,
        uint256 endTime
    );

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
        IOwnedUpgradeabilityProxy _governor,
        IVoteToken _trustToken,
        IVoteToken _stkTRU,
        uint256 _votingPeriod
    ) external {
        UpgradeableClaimable.initialize(msg.sender);
        timelock = _timelock;
        governor = _governor;
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
        require(requestCount >= requestId && requestId > 0, "Pauser::state: invalid request id");
        PauseRequest storage request = requests[requestId];
        if (request.executed) {
            return RequestState.Executed;
        } else if (block.timestamp >= add256(EXECUTION_PERIOD, request.endTime)) {
            return RequestState.Expired;
        } else if (request.votes >= quorumVotes()) {
            return RequestState.Succeeded;
        } else if (block.timestamp <= request.endTime) {
            return RequestState.Active;
        } else {
            return RequestState.Defeated;
        }
    }

    /**
     * @dev Create a request to pause the protocol or its parts
     * @param targets The ordered list of target addresses for calls to be made during request execution
     * @param methods The ordered list of function signatures to be passed during execution
     * @return The ID of the newly created request
     */
    function makeRequest(address[] memory targets, PausingMethod[] memory methods) public returns (uint256) {
        require(
            countVotes(msg.sender, sub256(block.number, 1)) > requestThreshold(),
            "Pauser::makeRequest: requester votes below request threshold"
        );
        require(targets.length == methods.length, "Pauser::makeRequest: request function information arity mismatch");
        require(targets.length != 0, "Pauser::makeRequest: must provide actions");
        require(targets.length <= requestMaxOperations(), "Pauser::makeRequest: too many actions");

        uint256 latestRequestId = latestRequestIds[msg.sender];
        if (latestRequestId != 0) {
            RequestState proposersLatestRequestState = state(latestRequestId);
            require(
                proposersLatestRequestState != RequestState.Active,
                "Pauser::makeRequest: one live request per proposer, found an already active request"
            );
        }

        uint256 startBlock = block.number;
        uint256 endTime = add256(block.timestamp, votingPeriod);

        requestCount++;
        PauseRequest memory newRequest = PauseRequest({
            id: requestCount,
            requester: msg.sender,
            targets: targets,
            methods: methods,
            startBlock: startBlock,
            endTime: endTime,
            votes: 0,
            executed: false
        });

        requests[newRequest.id] = newRequest;
        latestRequestIds[newRequest.requester] = newRequest.id;

        emit RequestCreated(newRequest.id, msg.sender, targets, methods, startBlock, endTime);
        return newRequest.id;
    }

    /**
     * @dev Execute a request after enough votes have been accumulated
     * @param requestId ID of a request that has queued
     */
    function execute(uint256 requestId) external {
        require(state(requestId) == RequestState.Succeeded, "Pauser::execute: request can only be executed if it is succeeded");
        PauseRequest storage request = requests[requestId];
        request.executed = true;
        for (uint256 i = 0; i < request.targets.length; i++) {
            require(request.targets[i] != address(governor), "Pauser::execute: cannot pause the governor contract");
            if (request.methods[i] == PausingMethod.Status) {
                timelock.setPauseStatus(IPauseableContract(request.targets[i]), true);
            } else if (request.methods[i] == PausingMethod.Proxy) {
                timelock.emergencyPauseProxy(IOwnedUpgradeabilityProxy(request.targets[i]));
            } else if (request.methods[i] == PausingMethod.Reference) {
                timelock.emergencyPauseReference(ImplementationReference(request.targets[i]));
            }
        }
        emit RequestExecuted(requestId);
    }

    /**
     * @dev Get the actions of a selected request
     * @param requestId ID of a request
     * return An array of target addresses, an array of request pausing methods
     */
    function getActions(uint256 requestId) public view returns (address[] memory targets, PausingMethod[] memory methods) {
        PauseRequest storage r = requests[requestId];
        return (r.targets, r.methods);
    }

    /**
     * @dev Get a request ballot receipt of the indicated voter
     * @param requestId ID of a request in which to get voter's ballot receipt
     * @return the Ballot receipt record for a voter
     */
    function getReceipt(uint256 requestId, address voter) public view returns (Receipt memory) {
        return requests[requestId].receipts[voter];
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
        uint96 totalVote = add96(truVote, stkTRUVote, "Pauser::countVotes: addition overflow");
        return totalVote;
    }

    /**
     * @dev Cast a vote on a request
     * @param requestId ID of a request in which to cast a vote
     */
    function castVote(uint256 requestId) public {
        return _castVote(msg.sender, requestId);
    }

    /**
     * @dev Cast a vote on a request internal function
     * @param voter The address of the voter
     * @param requestId ID of a request in which to cast a vote
     */
    function _castVote(address voter, uint256 requestId) internal {
        require(state(requestId) == RequestState.Active, "Pauser::_castVote: voting is closed");
        PauseRequest storage request = requests[requestId];
        Receipt storage receipt = request.receipts[voter];
        require(!receipt.hasVoted, "Pauser::_castVote: voter already voted");
        uint96 votes = countVotes(voter, request.startBlock);

        request.votes = add256(request.votes, votes);

        receipt.hasVoted = true;
        receipt.votes = votes;

        emit VoteCast(voter, requestId, votes);
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
     * @dev safe addition function for uint256
     */
    function add256(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "addition overflow");
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
