// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";

contract SAFU is UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    ILoanFactory2 public loanFactory;

    event Redeemed(uint256 burnedAmount, uint256 redeemedAmount);

    function initialize(ILoanFactory2 _loanFactory) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        loanFactory = _loanFactory;
    }

    function liquidate(ILoanToken2 loan) external {
        require(loanFactory.isLoanToken(address(loan)), "SAFU: Unknown loan");
        require(loan.status() == ILoanToken2.Status.Defaulted, "SAFU: Loan is not defaulted");
        ITrueFiPool2 pool = ITrueFiPool2(loan.pool());
        IERC20(pool.token()).safeTransfer(address(pool), loan.debt());
    }

    function redeem(ILoanToken2 loan) public onlyOwner {
        uint256 amountToBurn = loan.balanceOf(address(this));
        uint256 balanceBeforeRedeem = loan.token().balanceOf(address(this));
        loan.redeem(amountToBurn);
        uint256 redeemedAmount = loan.token().balanceOf(address(this)).sub(balanceBeforeRedeem);
        emit Redeemed(amountToBurn, redeemedAmount);
    }   
}
