// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {IStakingPool} from "../truefi/interface/IStakingPool.sol";
import {ITrueFiPoolOracle} from "./interface/ITrueFiPoolOracle.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {IDebtToken} from "../truefi2/interface/ILoanToken2.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title Liquidator2
 * @notice Liquidate LoanTokens with this Contract
 * @dev When a Loan becomes defaulted, Liquidator allows to
 * compensate pool participants, by transferring some of TRU to the pool
 */
contract Liquidator2 is UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // basis point for ratio
    uint256 private constant BASIS_RATIO = 10000;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IStakingPool public stkTru;
    IERC20 public tru;
    ILoanFactory2 public loanFactory;

    mapping(address => bool) private DEPRECATED__approvedTokens;

    // max share of tru to be taken from staking pool during liquidation
    // 1000 -> 10%
    uint256 public fetchMaxShare;

    // Address of SAFU fund, to which slashed tru is transferred after liquidation
    address public SAFU;

    IPoolFactory public poolFactory;

    ITrueFiPoolOracle public tusdPoolOracle;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted fetch max share is changed
     * @param newShare New share set
     */
    event FetchMaxShareChanged(uint256 newShare);

    /**
     * @dev Emitted when loans are liquidated
     * @param loans Loans that have been liquidated
     * @param defaultedValue Remaining loans debt to repay
     * @param withdrawnTru Amount of TRU transferred to compensate defaulted loans
     */
    event Liquidated(IDebtToken[] loans, uint256 defaultedValue, uint256 withdrawnTru);

    /**
     * @dev Emitted when SAFU is changed
     * @param SAFU New SAFU address
     */
    event AssuranceChanged(address SAFU);

    /**
     * @dev Emitted when pool factory is changed
     * @param poolFactory New pool factory address
     */
    event PoolFactoryChanged(IPoolFactory poolFactory);

    /**
     * @dev Initialize this contract
     */
    function initialize(
        IStakingPool _stkTru,
        IERC20 _tru,
        ILoanFactory2 _loanFactory,
        IPoolFactory _poolFactory,
        address _SAFU,
        ITrueFiPoolOracle _tusdPoolOracle
    ) public initializer {
        UpgradeableClaimable.initialize(msg.sender);

        stkTru = _stkTru;
        tru = _tru;
        loanFactory = _loanFactory;
        poolFactory = _poolFactory;
        SAFU = _SAFU;
        tusdPoolOracle = _tusdPoolOracle;
        fetchMaxShare = 1000;
    }

    /**
     * @dev Set a new SAFU address
     * @param _SAFU Address to be set as SAFU
     */
    function setAssurance(address _SAFU) external onlyOwner {
        SAFU = _SAFU;
        emit AssuranceChanged(_SAFU);
    }

    /**
     * @dev Set a new pool factory address
     * @param _poolFactory Address to be set as pool factory
     */
    function setPoolFactory(IPoolFactory _poolFactory) external onlyOwner {
        require(address(_poolFactory) != address(0), "Liquidator: Pool factory address cannot be set to 0");
        poolFactory = _poolFactory;
        emit PoolFactoryChanged(_poolFactory);
    }

    /**
     * @dev Set new max fetch share
     * @param newShare New share to be set
     */
    function setFetchMaxShare(uint256 newShare) external onlyOwner {
        require(newShare > 0, "Liquidator: Share cannot be set to 0");
        require(newShare <= BASIS_RATIO, "Liquidator: Share cannot be larger than 10000");
        fetchMaxShare = newShare;
        emit FetchMaxShareChanged(newShare);
    }

    /**
     * @dev Liquidates a defaulted Loan, withdraws a portion of tru from staking pool
     * then transfers tru to TrueFiPool as compensation
     * @param loans Loan to be liquidated
     */
    function liquidate(IDebtToken[] memory loans) external {
        require(msg.sender == SAFU, "Liquidator: Only SAFU contract can liquidate a loan");
        uint256 totalDefaultedValue;

        for (uint256 i = 0; i < loans.length; i++) {
            IDebtToken loan = loans[i];
            require(loanFactory.isCreatedByFactory(address(loan)), "Liquidator: Unknown loan");
            require(loan.status() == IDebtToken.Status.Defaulted, "Liquidator: Loan must be defaulted");
            ITrueFiPool2 pool = ITrueFiPool2(loan.pool());
            require(poolFactory.isSupportedPool(pool), "Liquidator: Pool not supported for default protection");

            uint256 loanDefaultedValue = loan.debt().sub(loan.repaid());
            totalDefaultedValue = totalDefaultedValue.add(getDefaultedValueInUsd(loanDefaultedValue, pool.oracle()));
            loan.liquidate();
        }

        uint256 withdrawnTru = getAmountToWithdraw(totalDefaultedValue);
        stkTru.withdraw(withdrawnTru);
        tru.safeTransfer(SAFU, withdrawnTru);
        emit Liquidated(loans, totalDefaultedValue, withdrawnTru);
    }

    /**
     * @dev Calculate amount of tru to be withdrawn from staking pool (not more than preset share)
     * @param deficit Amount of tusd lost on defaulted loan
     * @return amount of TRU to be withdrawn on liquidation
     */
    function getAmountToWithdraw(uint256 deficit) internal view returns (uint256) {
        uint256 stakingPoolSupply = stkTru.stakeSupply();
        uint256 maxWithdrawValue = stakingPoolSupply.mul(fetchMaxShare).div(BASIS_RATIO);
        uint256 deficitInTru = tusdPoolOracle.tokenToTru(deficit);
        return maxWithdrawValue > deficitInTru ? deficitInTru : maxWithdrawValue;
    }

    function getDefaultedValueInUsd(uint256 defaultedValue, ITrueFiPoolOracle oracle) internal view returns (uint256) {
        return oracle.tokenToUsd(defaultedValue);
    }
}
