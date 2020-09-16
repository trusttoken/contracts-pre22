// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Liquidator} from "../trusttokens/Liquidator.sol";
import {StakedToken} from "../trusttokens/StakedToken.sol";
import {AssuredFinancialOpportunityStorage} from "../truecurrencies/AssuredFinancialOpportunityStorage.sol";
import {InitializableClaimable} from "../truecurrencies/modularERC20/InitializableClaimable.sol";
import {FractionalExponents} from "./utilities/FractionalExponents.sol";
import {FinancialOpportunity} from "./FinancialOpportunity.sol";

/**
 * @title AssuredFinancialOpportunity
 * @dev Wrap financial opportunity with Assurance
 *
 * -- Overview --
 * Rewards are earned as tokenValue() increases in the underlying opportunity
 * TUSD is never held in this contract - zTUSD represents value we owe to depositors
 *
 * -- zTUSD vs yTUSD --
 * zTUSD represents an amount of ASSURED TUSD owed to the zTUSD holder (depositors)
 * 1 zTUSD = (yTUSD ^ assurance ratio)
 * yTUSD represents an amount of NON-ASSURED TUSD owed to this contract
 * TUSD value = yTUSD * finOp.tokenValue()
 *
 * -- Awarding the Assurance Pool
 * The difference increases when depositors withdraw
 * Pool award is calculated as follows
 * (finOpValue * finOpBalance) - (assuredOpportunityBalance * assuredOpportunityTokenValue)
 *
 * -- Flash Assurance --
 * If a transfer fails, stake is sold from the assurance pool for TUSD
 * When stake is liquidated, the TUSD is sent out in the same transaction
 * Can attempt to sell bad debt at a later date and return value to the pool
 *
 * -- Assumptions --
 * tokenValue can never decrease for this contract. We want to guarantee
 * the awards earned on deposited TUSD and liquidate trusttokens for this amount
 * We allow the rewardBasis to be adjusted, but since we still need to maintain
 * the tokenValue, we calculate an adjustment factor and set minTokenValue
 *
 **/
contract AssuredFinancialOpportunity is FinancialOpportunity, AssuredFinancialOpportunityStorage, InitializableClaimable {
    using SafeMath for uint256;

    // tolerance of rounding errors
    uint8 constant TOLERANCE = 100;
    // total basis points for pool awards
    uint32 constant TOTAL_BASIS = 1000;

    // external contracts
    address finOpAddress;
    address assuranceAddress;
    address liquidatorAddress;
    address exponentContractAddress;
    address trueRewardBackedTokenAddress;

    // address allowed to withdraw/deposit, usually set to address of TUSD smart contract
    address fundsManager;

    /// @dev Emitted on new deposit by account. tusd amount was depositted, ztusd was given in exchange
    event Deposit(address indexed account, uint256 tusd, uint256 ztusd);
    /// @dev Emitted on new redemption by account. ztusd amount was redempted, tusd was given in exchange
    event Redemption(address indexed to, uint256 ztusd, uint256 tusd);
    /// @dev Emitted when liquidation is triggered for debt amount
    event Liquidation(address indexed receiver, int256 debt);
    /// @dev Emitted when award was successfully transferred to staking pool
    event AwardPool(uint256 amount);
    /// @dev Emitted when award transfer to staking pool failed
    event AwardFailure(uint256 amount);

    /// funds manager can deposit/withdraw from this opportunity
    modifier onlyFundsManager() {
        require(msg.sender == fundsManager, "only funds manager");
        _;
    }

    /**
     * @dev configure assured opportunity
     */
    function configure(
        address _finOpAddress, // finOp to assure
        address _assuranceAddress, // assurance pool
        address _liquidatorAddress, // trusttoken liquidator
        address _exponentContractAddress, // exponent contract
        address _trueRewardBackedTokenAddress, // token
        address _fundsManager // funds manager
    ) external {
        require(_finOpAddress != address(0), "finOp cannot be address(0)");
        require(_assuranceAddress != address(0), "assurance pool cannot be address(0)");
        require(_liquidatorAddress != address(0), "liquidator cannot be address(0)");
        require(_exponentContractAddress != address(0), "exponent cannot be address(0)");
        require(_trueRewardBackedTokenAddress != address(0), "token cannot be address(0)");
        require(_fundsManager != address(0), "findsManager cannot be address(0)");
        super._configure(); // sender claims ownership here
        finOpAddress = _finOpAddress;
        assuranceAddress = _assuranceAddress;
        liquidatorAddress = _liquidatorAddress;
        exponentContractAddress = _exponentContractAddress;
        trueRewardBackedTokenAddress = _trueRewardBackedTokenAddress;
        fundsManager = _fundsManager;
        // only update factors if they are zero (default)
        if (adjustmentFactor == 0) {
            adjustmentFactor = 1 * 10**18;
        }
        if (rewardBasis == 0) {
            rewardBasis = TOTAL_BASIS; // set to 100% by default
        }
    }

    /**
     * @dev total supply of zTUSD
     * inherited from FinancialOpportunity.sol
     */
    function totalSupply() external override view returns (uint256) {
        return zTUSDIssued;
    }

    /**
     * @dev value of TUSD per zTUSD
     * inherited from FinancialOpportunity.sol
     *
     * @return TUSD value of zTUSD
     */
    function tokenValue() external override view returns (uint256) {
        return _tokenValue();
    }

    /**
     * @dev deposit TUSD for zTUSD
     * inherited from FinancialOpportunity.sol
     *
     * @param from address to deposit from
     * @param amount TUSD amount to deposit
     * @return zTUSD amount
     */
    function deposit(address from, uint256 amount) external override onlyFundsManager returns (uint256) {
        return _deposit(from, amount);
    }

    /**
     * @dev redeem zTUSD for TUSD
     * inherited from FinancialOpportunity.sol
     *
     * @param to address to send tusd to
     * @param amount amount of zTUSD to redeem
     * @return amount of TUSD returned by finOp
     */
    function redeem(address to, uint256 amount) external override onlyFundsManager returns (uint256) {
        return _redeem(to, amount);
    }

    /**
     * @dev Get TUSD to be awarded to staking pool
     * Calculated as the difference in value of total zTUSD and yTUSD
     * (finOpTotalSupply * finOpTokenValue) - (zTUSDIssued * zTUSDTokenValue)
     *
     * @return pool balance in TUSD
     */
    function poolAwardBalance() public view returns (uint256) {
        uint256 zTUSDValue = finOp().tokenValue().mul(finOp().totalSupply()).div(10**18);
        uint256 yTUSDValue = _totalSupply().mul(_tokenValue()).div(10**18);
        return zTUSDValue.sub(yTUSDValue);
    }

    /**
     * @dev Sell yTUSD for TUSD and deposit into staking pool.
     * Award amount is the difference between zTUSD issued an
     * yTUSD in the underlying financial opportunity
     */
    function awardPool() external {
        uint256 amount = poolAwardBalance();
        uint256 ytusd = _yTUSD(amount);

        // sell pool debt and award TUSD to pool
        (bool success, uint256 returnedAmount) = _attemptRedeem(address(this), ytusd);

        if (success) {
            token().transfer(address(pool()), returnedAmount);
            emit AwardPool(returnedAmount);
        } else {
            emit AwardFailure(returnedAmount);
        }
    }

    /**
     * @dev set new reward basis for opportunity
     * recalculate tokenValue and ensure tokenValue never decreases
     *
     * @param newBasis new reward basis
     */
    function setRewardBasis(uint32 newBasis) external onlyOwner {
        minTokenValue = _tokenValue();

        adjustmentFactor = adjustmentFactor.mul(_calculateTokenValue(rewardBasis)).div(_calculateTokenValue(newBasis));
        rewardBasis = newBasis;
    }

    /**
     * @dev Get supply amount of zTUSD issued
     * @return zTUSD issued
     **/
    function _totalSupply() internal view returns (uint256) {
        return zTUSDIssued;
    }

    /**
     * Calculate yTUSD / zTUSD (opportunity value minus pool award)
     * We assume opportunity tokenValue always goes up
     *
     * @return value of zTUSD
     */
    function _tokenValue() internal view returns (uint256) {
        // if no assurance, use  opportunity tokenValue
        if (rewardBasis == TOTAL_BASIS) {
            return finOp().tokenValue();
        }
        uint256 calculatedValue = _calculateTokenValue(rewardBasis).mul(adjustmentFactor).div(10**18);
        if (calculatedValue < minTokenValue) {
            return minTokenValue;
        } else {
            return calculatedValue;
        }
    }

    /**
     * @dev calculate TUSD value of zTUSD
     * zTUSD = yTUSD ^ (rewardBasis / totalBasis)
     * reward ratio = _rewardBasis / TOTAL_BASIS
     *
     * @param _rewardBasis reward basis (max TOTAL_BASIS)
     * @return zTUSD token value
     */
    function _calculateTokenValue(uint32 _rewardBasis) internal view returns (uint256) {
        (uint256 result, uint8 precision) = exponents().power(finOp().tokenValue(), 10**18, _rewardBasis, TOTAL_BASIS);
        return result.mul(10**18).div(2**uint256(precision));
    }

    /**
     * @dev Deposit TUSD into wrapped opportunity.
     * Calculate zTUSD value and add to issuance value.
     *
     * @param _account account to deposit tusd from
     * @param _amount amount of tusd to deposit
     */
    function _deposit(address _account, uint256 _amount) internal returns (uint256) {
        token().transferFrom(_account, address(this), _amount);

        // deposit TUSD into opportunity
        token().approve(finOpAddress, _amount);
        finOp().deposit(address(this), _amount);

        // calculate zTUSD value of deposit
        uint256 ztusd = _amount.mul(10**18).div(_tokenValue());

        // update zTUSDIssued
        zTUSDIssued = zTUSDIssued.add(ztusd);
        emit Deposit(_account, _amount, ztusd);
        return ztusd;
    }

    /**
     * @dev Redeem zTUSD for TUSD
     * Liquidate if opportunity fails to return TUSD.
     *
     * @param _to address to withdraw to
     * @param ztusd amount in ytusd to redeem
     * @return TUSD amount redeemed for zTUSD
     */
    function _redeem(address _to, uint256 ztusd) internal returns (uint256) {
        // attempt withdraw to this contract
        // here we redeem ztusd amount which leaves
        // a small amount of yTUSD left in the finOp
        // which can be redeemed by the assurance pool
        (bool success, uint256 returnedAmount) = _attemptRedeem(address(this), ztusd);

        // calculate reward amount
        // todo feewet: check if expected amount is correct
        // possible use precision threshold or smart rounding
        // to eliminate micro liquidations
        uint256 expectedAmount = _tokenValue().mul(ztusd).div(10**18);
        uint256 liquidated = 0;

        if (!success || (returnedAmount.add(TOLERANCE) < expectedAmount)) {
            liquidated = _liquidate(address(this), int256(expectedAmount.sub(returnedAmount)));
        }

        zTUSDIssued = zTUSDIssued.sub(ztusd, "not enough supply");

        // transfer token to redeemer
        require(token().transfer(_to, returnedAmount.add(liquidated)), "transfer failed");

        emit Redemption(_to, ztusd, returnedAmount);
        return returnedAmount;
    }

    /**
     * @dev Try to redeem and return success and amount
     *
     * @param _to redeemer address
     * @param ztusd amount in ztusd
     **/
    function _attemptRedeem(address _to, uint256 ztusd) internal returns (bool, uint256) {
        // attempt to withdraw from opportunity
        try finOp().redeem(_to, ztusd) returns (uint256 fundsWithdrawn) {
            return (true, fundsWithdrawn);
        } catch (bytes memory) {
            return (false, 0);
        }
    }

    /**
     * @dev Liquidate tokens in staking pool to cover debt
     * Sends tusd to receiver
     *
     * @param _receiver address to receive tusd
     * @param _debt tusd debt to be liquidated
     * @return amount liquidated
     **/
    function _liquidate(address _receiver, int256 _debt) internal returns (uint256) {
        liquidator().reclaim(_receiver, _debt);
        emit Liquidation(_receiver, _debt);
        return uint256(_debt);
    }

    /**
     * @dev convert tusd value into yTUSD value
     * @param _tusd TUSD to convert
     * @return yTUSD value of TUSD
     */
    function _yTUSD(uint256 _tusd) internal view returns (uint256) {
        return _tusd.mul(10**18).div(finOp().tokenValue());
    }

    /**
     * @dev convert tusd value into zTUSD value
     * @param _tusd TUSD to convert
     * @return zTUSD value of TUSD
     */
    function _zTUSD(uint256 _tusd) internal view returns (uint256) {
        return _tusd.mul(10**18).div(_tokenValue());
    }

    /// @dev claim ownership of liquidator
    function claimLiquidatorOwnership() external onlyOwner {
        liquidator().claimOwnership();
    }

    /// @dev transfer ownership of liquidator
    function transferLiquidatorOwnership(address newOwner) external onlyOwner {
        liquidator().transferOwnership(newOwner);
    }

    /// @dev getter for financial opportunity
    /// @return financial opportunity
    function finOp() public view returns (FinancialOpportunity) {
        return FinancialOpportunity(finOpAddress);
    }

    /// @dev getter for staking pool
    /// @return staking pool
    function pool() public view returns (StakedToken) {
        return StakedToken(assuranceAddress); // StakedToken is assurance staking pool
    }

    /// @dev getter for liquidator
    function liquidator() public view returns (Liquidator) {
        return Liquidator(liquidatorAddress);
    }

    /// @dev getter for exponents contract
    function exponents() public view returns (FractionalExponents) {
        return FractionalExponents(exponentContractAddress);
    }

    /// @dev deposit token (TrueUSD)
    function token() public view returns (IERC20) {
        return IERC20(trueRewardBackedTokenAddress);
    }

    /// @dev default payable
    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
