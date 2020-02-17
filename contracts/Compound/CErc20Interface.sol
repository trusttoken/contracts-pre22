pragma solidity ^0.5.13;

interface CErc20Interface {
    function mint(uint mintAmount) external returns (uint);
    function redeem(uint redeemTokens) external returns (uint);
    function balanceOfUnderlying(address owner) external returns (uint);
}
