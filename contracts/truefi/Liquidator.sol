// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "./common/UpgradeableOwnable.sol";
import {LoanToken, IERC20} from "./LoanToken.sol";

import {ILoanToken} from "./interface/ILoanToken.sol";
import {ITrueFiPool} from "./interface/ITrueFiPool.sol";
import {IStakingPool} from "./interface/IStakingPool.sol";
import {IMockTruPriceOracle} from "./../interface/IMockTruPriceOracle.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title Liquidator
 * @notice Liquidate LoanTokens with this Contract
 * @dev When a Loan becomes defaulted, Liquidator allows to
 * compensate pool participants, by transfering some of TRU to the pool
 */
contract Liquidator is Ownable {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    ITrueFiPool public pool;
    IStakingPool public stkTru;
    IERC20 public tru;
    IMockTruPriceOracle public oracle;

    // max share of tru to be taken from staking pool during liquidation
    // 1000 -> 10%
    uint256 public fetchMaxShare;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted fetch max share is changed
     * @param newShare New share set
     */
    event FetchMaxShareChanged(uint256 newShare);

    /**
     * @dev Emitted when a loan gets liquidated
     * @param loan Loan that has been liquidated
     */
    event Liquidated(ILoanToken loan);

    /**
     * @dev Initialize this contract
     */
    function initialize(
        ITrueFiPool _pool,
        IStakingPool _stkTru,
        IERC20 _tru,
        IMockTruPriceOracle _oracle
    ) public initializer {
        Ownable.initialize();

        pool = _pool;
        stkTru = _stkTru;
        tru = _tru;
        oracle = _oracle;
        fetchMaxShare = 1000;
    }

    /**
     * @dev Set new max fetch share
     * @param newShare New share to be set
     */
    function setFetchMaxShare(uint256 newShare) external onlyOwner {
        require(newShare > 0, "Liquidator: Share cannot be set to 0");
        fetchMaxShare = newShare;
        emit FetchMaxShareChanged(newShare);
    }

    /**
     * @dev Liquidates a defaulted Loan, withdraws a portion of tru from staking pool
     * then transfers tru to TrueFiPool as compensation
     * @param loan Loan to be liquidated
     */
    function liquidate(ILoanToken loan) external {
        uint256 defaultedValue = getAmountToWithdraw(loan.debt().sub(loan.balance()));
        stkTru.withdraw(defaultedValue);
        loan.liquidate();
        require(tru.transfer(address(pool), defaultedValue));
        emit Liquidated(loan);
    }

    /**
     * @dev Calculate amount of tru to be withdrawn from staking pool (not more than preset share)
     * @param deficite Amount of tusd lost on defaulted loan
     */
    function getAmountToWithdraw(uint256 deficite) internal returns (uint256) {
        uint256 stakingPoolSupply = stkTru.stakeSupply();
        uint256 maxWithdrawValue = stakingPoolSupply.mul(fetchMaxShare).div(10000);
        uint deficiteInTru = oracle.toTru(deficite);
        return maxWithdrawValue > deficiteInTru ? deficiteInTru : maxWithdrawValue;
    }
}
