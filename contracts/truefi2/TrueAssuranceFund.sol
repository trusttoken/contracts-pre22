// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Initializable} from "../common/Initializable.sol";
import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";

contract TrueAssuranceFund is Initializable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ILoanFactory2 public loanFactory;

    function initialize(ILoanFactory2 _loanFactory) public initializer {
        loanFactory = _loanFactory;
    }

    function liquidate(ILoanToken2 loan) external {
        require(loanFactory.isLoanToken(address(loan)), "TrueAssuranceFund: Unknown loan");
        require(loan.status() == ILoanToken2.Status.Defaulted, "TrueAssuranceFund: Loan is not defaulted");
        ITrueFiPool2 pool = ITrueFiPool2(loan.pool());
        IERC20(pool.token()).safeTransfer(address(pool), loan.debt());
    }
}
