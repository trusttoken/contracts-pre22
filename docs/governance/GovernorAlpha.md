## `GovernorAlpha`






### `quorumVotes() → uint256` (public)





### `proposalThreshold() → uint256` (public)





### `proposalMaxOperations() → uint256` (public)





### `votingDelay() → uint256` (public)





### `initialize(contract ITimelock _timelock, contract IVoteToken _trustToken, address _guardian, contract IVoteToken _stkTRU, uint256 _votingPeriod)` (external)



Initialize sets the addresses of timelock contract, trusttoken contract, and guardian

### `propose(address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, string description) → uint256` (public)



Create a proposal to change the protocol


### `queue(uint256 proposalId)` (public)



Queue a proposal after a proposal has succeeded


### `_queueOrRevert(address target, uint256 value, string signature, bytes data, uint256 eta)` (internal)



Queue one single proposal transaction to timelock contract


### `execute(uint256 proposalId)` (public)



Execute a proposal after a proposal has queued and invoke each of the actions in the proposal


### `cancel(uint256 proposalId)` (public)



Cancel a proposal that has not yet been executed


### `getActions(uint256 proposalId) → address[] targets, uint256[] values, string[] signatures, bytes[] calldatas` (public)



Get the actions of a selected proposal


### `getReceipt(uint256 proposalId, address voter) → struct GovernorAlpha.Receipt` (public)



Get a proposal ballot receipt of the indicated voter


### `state(uint256 proposalId) → enum GovernorAlpha.ProposalState` (public)



Get the proposal state for the specified proposal


### `castVote(uint256 proposalId, bool support)` (public)



Cast a vote on a proposal


### `castVoteBySig(uint256 proposalId, bool support, uint8 v, bytes32 r, bytes32 s)` (public)



Cast a vote on a proposal by offline signatures


### `_castVote(address voter, uint256 proposalId, bool support)` (internal)



Cast a vote on a proposal internal function


### `__acceptAdmin()` (public)



Accept the pending admin as the admin in timelock contract

### `__abdicate()` (public)



Abdicate the guardian address to address(0)

### `__queueSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta)` (public)



Queue a setTimeLockPendingAdmin transaction to timelock contract


### `__executeSetTimelockPendingAdmin(address newPendingAdmin, uint256 eta)` (public)



Execute a setTimeLockPendingAdmin transaction to timelock contract


### `add256(uint256 a, uint256 b) → uint256` (internal)



safe addition function for uint256

### `sub256(uint256 a, uint256 b) → uint256` (internal)



safe subtraction function for uint256

### `getChainId() → uint256` (internal)



Get the chain ID


### `countVotes(address account, uint256 blockNumber) → uint96` (public)



Count the total PriorVotes from TRU and stkTRU


### `add96(uint96 a, uint96 b, string errorMessage) → uint96` (internal)






### `ProposalCreated(uint256 id, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 startBlock, uint256 endBlock, string description)`





### `VoteCast(address voter, uint256 proposalId, bool support, uint256 votes)`





### `ProposalCanceled(uint256 id)`





### `ProposalQueued(uint256 id, uint256 eta)`





### `ProposalExecuted(uint256 id)`





