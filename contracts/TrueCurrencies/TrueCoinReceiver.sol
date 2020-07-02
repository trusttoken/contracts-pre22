pragma solidity ^0.5.13;

contract TrueCoinReceiver {
    function tokenFallback( address from, uint256 value ) external;
}
