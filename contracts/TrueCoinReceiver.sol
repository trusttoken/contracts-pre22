pragma solidity ^0.4.24;

interface TrueCoinReceiver {
  function tokenFallback( address from, uint256 value ) external;
}
