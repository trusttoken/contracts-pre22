// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {IStakingPool} from "../truefi/interface/IStakingPool.sol";
import {ITrueFiPoolOracle} from "./interface/ITrueFiPoolOracle.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title Liquidator2
 * @notice Liquidate LoanTokens with this Contract
 * @dev When a Loan becomes defaulted, Liquidator allows to
 * compensate pool participants, by transferring some of TRU to the pool
 */
contract Liquidator2 is UpgradeableClaimable {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IPoolFactory public poolFactory;
    IStakingPool public stkTru;
    IERC20 public tru;
    ITrueFiPoolOracle public oracle;
    ILoanFactory2 public loanFactory;

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
     * @dev Emitted when oracle is changed
     * @param newOracle New oracle address
     */
    event OracleChanged(ITrueFiPoolOracle newOracle);

    /**
     * @dev Emitted when a loan gets liquidated
     * @param loan Loan that has been liquidated
     */
    event Liquidated(ILoanToken2 loan);

    /**
     * @dev Initialize this contract
     */
    function initialize(
        IPoolFactory _poolFactory,
        IStakingPool _stkTru,
        IERC20 _tru,
        ITrueFiPoolOracle _oracle,
        ILoanFactory2 _loanFactory
    ) public initializer {
        UpgradeableClaimable.initialize(msg.sender);

        poolFactory = _poolFactory;
        stkTru = _stkTru;
        tru = _tru;
        oracle = _oracle;
        loanFactory = _loanFactory;
        fetchMaxShare = 1000;
    }

    /**
     * @dev Set new max fetch share
     * @param newShare New share to be set
     */
    function setFetchMaxShare(uint256 newShare) external onlyOwner {
        require(newShare > 0, "Liquidator: Share cannot be set to 0");
        require(newShare <= 10000, "Liquidator: Share cannot be larger than 10000");
        fetchMaxShare = newShare;
        emit FetchMaxShareChanged(newShare);
    }

    /**
     * @dev Change oracle
     * @param newOracle New oracle for liquidator
     */
    function setOracle(ITrueFiPoolOracle newOracle) external onlyOwner {
        // Check if new oracle implements method
        require(newOracle.tokenToTru(1 ether) > 0, "Liquidator: Oracle lacks usdToTru method");

        oracle = newOracle;

        emit OracleChanged(newOracle);
    }

    /**
     * @dev Liquidates a defaulted Loan, withdraws a portion of tru from staking pool
     * then transfers tru to TrueFiPool as compensation
     * @param loan Loan to be liquidated
     */
    function liquidate(ILoanToken2 loan) external {
        require(loanFactory.isLoanToken(address(loan)), "Liquidator: Unknown loan");
        uint256 defaultedValue = getAmountToWithdraw(loan.debt().sub(loan.repaid()));
        stkTru.withdraw(defaultedValue);
        require(loan.status() == ILoanToken2.Status.Defaulted, "Liquidator: Loan must be defaulted");
        loan.liquidate();
        require(tru.transfer(address(poolFactory), defaultedValue));
        emit Liquidated(loan);
    }

    /**
     * @dev Calculate amount of tru to be withdrawn from staking pool (not more than preset share)
     * @param deficit Amount of tusd lost on defaulted loan
     * @return amount of TRU to be withdrawn on liquidation
     */
    function getAmountToWithdraw(uint256 deficit) internal view returns (uint256) {
        uint256 stakingPoolSupply = stkTru.stakeSupply();
        uint256 maxWithdrawValue = stakingPoolSupply.mul(fetchMaxShare).div(10000);
        uint256 deficitInTru = oracle.tokenToTru(deficit);
        return maxWithdrawValue > deficitInTru ? deficitInTru : maxWithdrawValue;
    }
}
