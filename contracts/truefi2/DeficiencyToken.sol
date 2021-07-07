// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {ILoanToken2} from "./interface/ILoanToken2.sol";

/**
 *
 */
contract DeficiencyToken is ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    ILoanToken2 public loan;

    /**
     * @dev Create Deficiency
     * @param _loan Defaulted loans address
     * @param _amount Amount of underlying pool token's that are owed to the pool
     */
    constructor(ILoanToken2 _loan, uint256 _amount) public {
        ERC20.__ERC20_initialize("TrueFi Deficiency Token", "DEF");

        loan = _loan;
        _mint(address(_loan.pool()), _amount);
    }
}
