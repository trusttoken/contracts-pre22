// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../ILendingPoolCore.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LendingPoolCoreMock is ILendingPoolCore {
    uint256 reserveNormalizedIncome = 1 * 10**27;

    function getReserveNormalizedIncome(address _reserve) external override view returns (uint256) {
        // silence compiler warning
        _reserve;

        return reserveNormalizedIncome;
    }

    function setReserveNormalizedIncome(uint256 value) external returns (uint256) {
        reserveNormalizedIncome = value;
    }

    function transferToReserve(
        address _reserve,
        address payable _user,
        uint256 _amount
    ) external override {
        require(ERC20(_reserve).transferFrom(_user, address(this), _amount), "LendingPoolCoreMock/transferToReserve");
    }
}
