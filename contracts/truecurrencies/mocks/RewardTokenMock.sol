// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../RewardToken.sol";

contract RewardTokenMock is RewardToken {
    constructor(address initialAccount, uint256 initialBalance) public {
        _setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
        burnMin = 0;
        burnMax = 1000000000 * 10**18;
    }

    function canBurn() internal override pure returns (bytes32) {
        return "canBurn";
    }

    function mintRewardTokenMock(
        address account,
        uint256 amount,
        address finOp
    ) external {
        mintRewardToken(account, amount, finOp);
    }

    function redeemRewardTokenMock(
        address account,
        uint256 amount,
        address finOp
    ) external {
        redeemRewardToken(account, amount, finOp);
    }

    function burnRewardTokenMock(
        address account,
        uint256 amount,
        address finOp
    ) external {
        burnRewardToken(account, amount, finOp);
    }

    function _addRewardBalanceMock(
        address account,
        uint256 amount,
        address finOp
    ) external {
        _addRewardBalance(account, amount, finOp);
    }

    function _subRewardBalanceMock(
        address account,
        uint256 amount,
        address finOp
    ) external {
        _subRewardBalance(account, amount, finOp);
    }

    function _toRewardTokenMock(uint256 amount, address finOp) public view returns (uint256) {
        return _toRewardToken(amount, finOp);
    }

    function _toTokenMock(uint256 amount, address finOp) public view returns (uint256) {
        return _toToken(amount, finOp);
    }
}
