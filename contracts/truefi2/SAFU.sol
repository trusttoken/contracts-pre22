// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {DeficiencyToken} from "./DeficiencyToken.sol";
import {IDeficiencyToken} from "./interface/IDeficiencyToken.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {IDebtToken} from "../truefi2/interface/IDebtToken.sol";
import {ILoanToken2Deprecated} from "./deprecated/ILoanToken2Deprecated.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {ILiquidator2} from "./interface/ILiquidator2.sol";
import {I1Inch3} from "./interface/I1Inch3.sol";
import {OneInchExchange} from "./libraries/OneInchExchange.sol";
import {ISAFU} from "./interface/ISAFU.sol";

contract SAFU is ISAFU, UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IDeficiencyToken;
    using SafeERC20 for ERC20;
    using OneInchExchange for I1Inch3;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    ILoanFactory2 public loanFactory;
    ILiquidator2 public liquidator;
    I1Inch3 public _1Inch;

    mapping(ILoanToken2Deprecated => IDeficiencyToken) public override legacyDeficiencyToken;
    mapping(address => uint256) public override poolDeficit;
    mapping(IDebtToken => IDeficiencyToken) public override deficiencyToken;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a debt is redeemed
     * @param debt Debt that has been liquidated
     * @param burnedAmount Amount of debt tokens that were burned
     * @param redeemedAmount Amount of tokens that were received
     */
    event Redeemed(IDebtToken debt, uint256 burnedAmount, uint256 redeemedAmount);

    /**
     * @dev Emitted when a debt gets liquidated
     * @param debt Debt that has been liquidated
     * @param repaid Amount repaid to the pool
     * @param deficiencyToken Deficiency token representing a deficit that is owed to the pool by SAFU
     * @param deficit Deficit amount that SAFU still owes the pool
     */
    event Liquidated(IDebtToken debt, uint256 repaid, IDeficiencyToken deficiencyToken, uint256 deficit);

    /**
     * @dev Emitted when a debt deficit is reclaimed
     * @param debt Defaulted debt, which deficit was reclaimed
     * @param reclaimed Amount reclaimed by the pool
     */
    event Reclaimed(IDebtToken debt, uint256 reclaimed);

    /**
     * @dev Emitted when SAFU swaps assets
     */
    event Swapped(uint256 amount, address srcToken, uint256 returnAmount, address dstToken);

    function initialize(
        ILoanFactory2 _loanFactory,
        ILiquidator2 _liquidator,
        I1Inch3 __1Inch
    ) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        loanFactory = _loanFactory;
        liquidator = _liquidator;
        _1Inch = __1Inch;
    }

    function legacyLiquidate(ILoanToken2Deprecated loan) external {
        require(loanFactory.isLegacyLoanToken(loan), "SAFU: Unknown loan");
        require(loan.status() == ILoanToken2Deprecated.Status.Defaulted, "SAFU: Loan is not defaulted");

        ITrueFiPool2 pool = loan.pool();
        IERC20 token = pool.token();

        liquidator.legacyLiquidate(loan);
        pool.liquidateLegacyLoan(loan);
        uint256 owedToPool = loan.debt().mul(tokenBalance(loan)).div(loan.totalSupply());
        uint256 safuTokenBalance = tokenBalance(token);
        uint256 toTransfer = owedToPool;
        DeficiencyToken _legacyDeficiencyToken;
        uint256 deficit;

        if (owedToPool > safuTokenBalance) {
            deficit = owedToPool.sub(safuTokenBalance);
            toTransfer = safuTokenBalance;
            _legacyDeficiencyToken = new DeficiencyToken(IDebtToken(address(loan)), deficit);
            legacyDeficiencyToken[loan] = _legacyDeficiencyToken;
            poolDeficit[address(pool)] = poolDeficit[address(pool)].add(deficit);
        }
        token.safeTransfer(address(pool), toTransfer);
        emit Liquidated(IDebtToken(address(loan)), toTransfer, _legacyDeficiencyToken, deficit);
    }

    /**
     * @dev Liquidates defaulted debts, withdraws a portion of tru from staking pool
     * @param borrower Borrower whose loans are to be liquidated
     */
    function liquidate(address borrower) external onlyOwner {
        IDebtToken[] memory debts = loanFactory.debtTokens(borrower);
        require(debts.length > 0, "SAFU: Borrower does not have any defaulted debts");
        for (uint256 i = 0; i < debts.length; i++) {
            require(loanFactory.isDebtToken(debts[i]), "SAFU: Unknown debt");
            require(!debts[i].isLiquidated(), "SAFU: Debt must not be liquidated");
        }

        liquidator.liquidate(debts);
    }

    /**
     * Tries to cover liquidated debts with own funds, to compensate TrueFiPool
     * If SAFU does not have enough funds, deficit is saved to be redeemed later
     * @param borrower Borrower who's loans are to be liquidated
     */
    function compensate(address borrower) external onlyOwner {
        IDebtToken[] memory debts = loanFactory.debtTokens(borrower);

        for (uint256 i = 0; i < debts.length; i++) {
            require(debts[i].isLiquidated(), "SAFU: Debt not liquidated yet");
            ITrueFiPool2 pool = ITrueFiPool2(debts[i].pool());
            IERC20 token = IERC20(pool.token());

            pool.liquidateDebt(debts[i]);
            uint256 owedToPool = debts[i].debt().mul(tokenBalance(debts[i])).div(debts[i].totalSupply());
            uint256 safuTokenBalance = tokenBalance(token);
            uint256 toTransfer = owedToPool;
            DeficiencyToken _deficiencyToken;
            uint256 deficit;

            if (owedToPool > safuTokenBalance) {
                deficit = owedToPool.sub(safuTokenBalance);
                toTransfer = safuTokenBalance;
                _deficiencyToken = new DeficiencyToken(debts[i], deficit);
                deficiencyToken[debts[i]] = _deficiencyToken;
                poolDeficit[address(pool)] = poolDeficit[address(pool)].add(deficit);
            }
            token.safeTransfer(address(pool), toTransfer);
            emit Liquidated(debts[i], toTransfer, _deficiencyToken, deficit);
        }
    }

    /**
     * @dev Returns SAFU's balance of a specific token
     * @param token A token which balance is to be returned
     */
    function tokenBalance(IERC20 token) public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function legacyRedeem(ILoanToken2Deprecated loan) public onlyOwner {
        require(loanFactory.isLegacyLoanToken(loan), "SAFU: Unknown loan");
        uint256 amountToBurn = tokenBalance(loan);
        uint256 balanceBeforeRedeem = tokenBalance(loan.token());
        loan.redeem(amountToBurn);
        uint256 redeemedAmount = tokenBalance(loan.token()).sub(balanceBeforeRedeem);
        emit Redeemed(IDebtToken(address(loan)), amountToBurn, redeemedAmount);
    }

    /**
     * @dev Redeems a repaid debt
     * @param debt Debt token to be redeemed
     */
    function redeem(IDebtToken debt) public onlyOwner {
        require(loanFactory.isDebtToken(debt), "SAFU: Unknown debt");
        uint256 amountToBurn = tokenBalance(debt);
        uint256 balanceBeforeRedeem = tokenBalance(debt.token());
        debt.redeem(amountToBurn);
        uint256 redeemedAmount = tokenBalance(debt.token()).sub(balanceBeforeRedeem);
        emit Redeemed(debt, amountToBurn, redeemedAmount);
    }

    function legacyReclaim(ILoanToken2Deprecated loan, uint256 amount) external override {
        require(loanFactory.isLegacyLoanToken(loan), "SAFU: Unknown loan");

        address poolAddress = address(loan.pool());
        require(msg.sender == poolAddress, "SAFU: caller is not the loan's pool");
        require(tokenBalance(loan) == 0, "SAFU: Loan has to be fully redeemed by SAFU");
        IDeficiencyToken dToken = legacyDeficiencyToken[loan];
        require(address(dToken) != address(0), "SAFU: No deficiency token found for loan");
        require(dToken.balanceOf(poolAddress) > 0, "SAFU: Pool does not have deficiency tokens to be reclaimed");

        poolDeficit[poolAddress] = poolDeficit[poolAddress].sub(amount);
        dToken.burnFrom(msg.sender, amount);
        loan.token().safeTransfer(poolAddress, amount);

        emit Reclaimed(IDebtToken(address(loan)), amount);
    }

    /**
     * @dev Reclaims deficit funds, after a debt is repaid and transfers them to the pool
     * @param debt Debt with a deficit to be reclaimed
     * @param amount Amount of deficiency tokens to be reclaimed
     */
    function reclaim(IDebtToken debt, uint256 amount) external override {
        require(loanFactory.isDebtToken(debt), "SAFU: Unknown debt");

        address poolAddress = address(debt.pool());
        require(msg.sender == poolAddress, "SAFU: caller is not the debt's pool");
        require(tokenBalance(debt) == 0, "SAFU: Debt has to be fully redeemed by SAFU");
        IDeficiencyToken dToken = deficiencyToken[debt];
        require(address(dToken) != address(0), "SAFU: No deficiency token found for debt");
        require(dToken.balanceOf(poolAddress) > 0, "SAFU: Pool does not have deficiency tokens to be reclaimed");

        poolDeficit[poolAddress] = poolDeficit[poolAddress].sub(amount);
        dToken.burnFrom(msg.sender, amount);
        debt.token().safeTransfer(poolAddress, amount);

        emit Reclaimed(debt, amount);
    }

    /**
     * @dev Swap any asset owned by SAFU to any other asset, using 1inch protocol
     */
    function swap(bytes calldata data, uint256 minReturnAmount) external onlyOwner {
        (I1Inch3.SwapDescription memory swapResult, uint256 returnAmount) = _1Inch.exchange(data);
        require(swapResult.dstReceiver == address(this), "SAFU: Receiver is not SAFU");
        require(returnAmount >= minReturnAmount, "SAFU: Not enough tokens returned from swap");

        emit Swapped(swapResult.amount, swapResult.srcToken, returnAmount, swapResult.dstToken);
    }
}
