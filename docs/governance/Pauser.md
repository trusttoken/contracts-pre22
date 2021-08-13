## `Pauser`






### `quorumVotes() → uint256` (public)





### `requestThreshold() → uint256` (public)





### `requestMaxOperations() → uint256` (public)





### `initialize(contract ITimelock _timelock, contract IOwnedUpgradeabilityProxy _governor, contract IVoteToken _trustToken, contract IVoteToken _stkTRU, uint256 _votingPeriod)` (external)



Initialize sets initial contract variables

### `state(uint256 requestId) → enum Pauser.RequestState` (public)



Get the request state for the specified request


### `makeRequest(address[] targets, enum Pauser.PausingMethod[] methods) → uint256` (public)



Create a request to pause the protocol or its parts


### `execute(uint256 requestId)` (external)



Execute a request after enough votes have been accumulated


### `getActions(uint256 requestId) → address[] targets, enum Pauser.PausingMethod[] methods` (public)



Get the actions of a selected request


### `getReceipt(uint256 requestId, address voter) → struct Pauser.Receipt` (public)



Get a request ballot receipt of the indicated voter


### `countVotes(address account, uint256 blockNumber) → uint96` (public)



Count the total PriorVotes from TRU and stkTRU


### `castVote(uint256 requestId)` (public)



Cast a vote on a request


### `_castVote(address voter, uint256 requestId)` (internal)



Cast a vote on a request internal function


### `add96(uint96 a, uint96 b, string errorMessage) → uint96` (internal)



safe96 add function


### `add256(uint256 a, uint256 b) → uint256` (internal)



safe addition function for uint256

### `sub256(uint256 a, uint256 b) → uint256` (internal)



safe subtraction function for uint256


### `RequestExecuted(uint256 id)`





### `VoteCast(address voter, uint256 requestId, uint256 votes)`





### `RequestCreated(uint256 id, address requester, address[] targets, enum Pauser.PausingMethod[] methods, uint256 startBlock, uint256 endTime)`





