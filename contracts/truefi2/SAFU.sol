// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {ILiquidator2} from "./interface/ILiquidator2.sol";

contract SAFU is UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    ILoanFactory2 public loanFactory;
    ILiquidator2 public liquidator;

    mapping(ILoanToken2 => uint256) public loanDeficit;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a loan gets liquidated
     * @param loan Loan that has been liquidated
     * @param repaid Amount repaid to the pool
     * @param deficit Deficit amount that SAFU still owes the pool
     */
    event Liquidated(ILoanToken2 loan, uint256 repaid, uint256 deficit);

    function initialize(ILoanFactory2 _loanFactory, ILiquidator2 _liquidator) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        loanFactory = _loanFactory;
        liquidator = _liquidator;
    }

    function liquidate(ILoanToken2 loan) external {
        require(loanFactory.isLoanToken(address(loan)), "SAFU: Unknown loan");
        require(loan.status() == ILoanToken2.Status.Defaulted, "SAFU: Loan is not defaulted");

        ITrueFiPool2 pool = ITrueFiPool2(loan.pool());
        IERC20 token = IERC20(pool.token());

        liquidator.liquidate(loan);
        pool.liquidate(loan);
        uint256 owedToPool = loan.debt().mul(tokenBalance(loan)).div(loan.totalSupply());
        uint256 safuTokenBalance = tokenBalance(token);

        uint256 deficit = 0;
        uint256 toTransfer = owedToPool;
        if (owedToPool > safuTokenBalance) {
            deficit = owedToPool.sub(safuTokenBalance);
            toTransfer = safuTokenBalance;
            loanDeficit[loan] = deficit;
        }
        token.safeTransfer(address(pool), toTransfer);
        emit Liquidated(loan, toTransfer, deficit);
    }

    function tokenBalance(IERC20 token) public view returns (uint256) {
        return token.balanceOf(address(this));
    }
}
