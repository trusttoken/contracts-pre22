pragma solidity ^0.5.13;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../yTrueUSDInterface.sol";

contract yTrueUSDMock is yTrueUSDInterface, ERC20 {
    IERC20 public token;
    mapping (address => uint256) public balance;
    uint256 public exchangeRate = 1*10**18;
    bool public redeemEnabled = true;

    constructor(
        IERC20 _token
    ) public {
        token = _token;
    }

    function deposit(uint mintAmount) external {
        require(token.allowance(msg.sender, address(this)) >= mintAmount);
        require(token.balanceOf(msg.sender) >= mintAmount);

        require(token.transferFrom(msg.sender, address(this), mintAmount), "transfer failed");
        balance[msg.sender] += tokenCountOf(mintAmount);
    }

    function withdraw(uint redeemTokens) external {
        require(redeemEnabled);
        require(balance[msg.sender] < redeemTokens);

        balance[msg.sender] -= redeemTokens;
        require(token.transfer(msg.sender, underlyingValueOf(redeemTokens)), "transfer failed");
    }

    function underlyingValueOf(uint256 tokens) internal returns (uint) {
        return tokens * exchangeRate / (10**18);
    }

    function tokenCountOf(uint256 value) internal returns (uint) {
        return value * (10**18) / exchangeRate;
    }

    function balanceOf(address owner) public view returns (uint256) {
        return balance[owner];
    }

    function balanceOfUnderlying(address owner) external returns (uint) {
        return underlyingValueOf(balance[owner]);
    }

    function setExchangeRate(uint256 _exchangeRate) external {
        exchangeRate = _exchangeRate;
    }

    function setRedeemEnabled(bool _redeemEnabled) external {
        redeemEnabled = _redeemEnabled;
    }
}
