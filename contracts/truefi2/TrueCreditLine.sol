// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";

contract TrueCreditLine is ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    address public borrower;
    address public pool;

    uint256 public principalDebt;

    /**
     * @dev Create Credit Line
     * @param _borrower Borrower address
     * @param _pool Pool to which the credit line is attached to
     * @param _principalDebt Initial amount of debt taken by borrower
     */
    constructor(
        address _borrower,
        address _pool,
        uint256 _principalDebt
    ) public {
        ERC20.__ERC20_initialize("TrueFi Credit Line", "tfCL");

        borrower = _borrower;
        pool = _pool;

        principalDebt = _principalDebt;
        _mint(_pool, _principalDebt);
    }

    function version() external pure returns (uint8) {
        return 0;
    }
}
