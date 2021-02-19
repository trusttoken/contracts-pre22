## `VoteToken`

Custom token which tracks voting power for governance


This is an abstraction of a fork of the Compound governance contract
VoteToken is used by TRU and stkTRU to allow tracking voting power
Checkpoints are created every time state is changed which record voting power
Inherits standard ERC20 behavior


### `delegate(address delegatee)` (public)





### `delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)` (public)



Delegate votes using signature

### `getCurrentVotes(address account) → uint96` (public)



Get current voting power for an account


### `getPriorVotes(address account, uint256 blockNumber) → uint96` (public)



Get voting power at a specific block for an account


### `_delegate(address delegator, address delegatee)` (internal)



Internal function to delegate voting power to an account


### `_balanceOf(address account) → uint256` (internal)





### `_transfer(address _from, address _to, uint256 _value)` (internal)





### `_mint(address account, uint256 amount)` (internal)





### `_burn(address account, uint256 amount)` (internal)





### `_moveDelegates(address srcRep, address dstRep, uint96 amount)` (internal)



internal function to move delegates between accounts

### `_writeCheckpoint(address delegatee, uint32 nCheckpoints, uint96 oldVotes, uint96 newVotes)` (internal)



internal function to write a checkpoint for voting power

### `safe32(uint256 n, string errorMessage) → uint32` (internal)



internal function to convert from uint256 to uint32

### `safe96(uint256 n, string errorMessage) → uint96` (internal)



internal function to convert from uint256 to uint96

### `add96(uint96 a, uint96 b, string errorMessage) → uint96` (internal)



internal safe math function to add two uint96 numbers

### `sub96(uint96 a, uint96 b, string errorMessage) → uint96` (internal)



internal safe math function to subtract two uint96 numbers

### `getChainId() → uint256` (internal)



internal function to get chain ID


### `DelegateChanged(address delegator, address fromDelegate, address toDelegate)`





### `DelegateVotesChanged(address delegate, uint256 previousBalance, uint256 newBalance)`





