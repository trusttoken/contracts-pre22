// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "@openzeppelin/contracts/math/SafeMath.sol";

contract FinancialOpportunityMock {
    using SafeMath for uint256;

    function deposit(address from, uint256 amount) external pure returns (uint256) {
        // silence compiler warning
        from;

        return amount.mul(101).div(103);
    }

    function redeem(address from, uint256 amount) external pure returns (uint256) {
        // silence compiler warning
        from;

        return amount.mul(10**18).div(tokenValue());
    }

    function tokenValue() public pure returns (uint256) {
        return 1004165248827609279;
    }
}
