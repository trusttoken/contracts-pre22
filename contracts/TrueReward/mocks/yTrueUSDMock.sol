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
        require(token.allowance(msg.sender, address(this)) >= mintAmount, "not enough allowance");
        require(token.balanceOf(msg.sender) >= mintAmount, "not enough balance");

        require(token.transferFrom(msg.sender, address(this), mintAmount), "transfer failed");
        balance[msg.sender] += shareCountOf(mintAmount);
    }

    function withdraw(uint shares) external {
        require(redeemEnabled, "redeem disabled");
        require(balance[msg.sender] >= shares, "not enough shares");

        balance[msg.sender] -= shares;
        require(token.transfer(msg.sender, underlyingValueOf(shares)), "transfer failed");
    }

    function underlyingValueOf(uint256 shares) internal returns (uint) {
        return shares * exchangeRate / (10**18);
    }

    function shareCountOf(uint256 value) internal returns (uint) {
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
