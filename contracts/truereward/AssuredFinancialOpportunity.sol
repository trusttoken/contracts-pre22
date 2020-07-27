// SPDX-License-Identifier: UNLICENSED
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
 * TrueCurrency is never held in this contract - zTrueCurrency represents value we owe to depositors
 *
 * -- zTrueCurrency vs yTrueCurrency --
 * zTrueCurrency represents an amount of ASSURED TrueCurrency owed to the zTrueCurrency holder (depositors)
 * 1 zTrueCurrency = (yTrueCurrency ^ assurance ratio)
 * yTrueCurrency represents an amount of NON-ASSURED TrueCurrency owed to this contract
 * TrueCurrency value = yTrueCurrency * finOp.tokenValue()
 *
 * -- Awarding the Assurance Pool
 * The difference increases when depositors withdraw
 * Pool award is calculated as follows
 * (finOpValue * finOpBalance) - (assuredOpportunityBalance * assuredOpportunityTokenValue)
 *
 * -- Flash Assurance --
 * If a transfer fails, stake is sold from the assurance pool for TrueCurrency
 * When stake is liquidated, the TrueCurrency is sent out in the same transaction
 * Can attempt to sell bad debt at a later date and return value to the pool
 *
 * -- Assumptions --
 * tokenValue can never decrease for this contract. We want to guarantee
 * the awards earned on deposited TrueCurrency and liquidate trusttokens for this amount
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

    // address allowed to withdraw/deposit, usually set to address of TrueCurrency smart contract
    address fundsManager;

    /// @dev Emitted on new deposit by account. trueCurrency amount was deposited, zTrueCurrency was given in exchange
    event Deposit(address indexed account, uint256 trueCurrency, uint256 zTrueCurrency);
    /// @dev Emitted on new redemption by account. zTrueCurrency amount was redempted, trueCurrency was given in exchange
    event Redemption(address indexed to, uint256 zTrueCurrency, uint256 trueCurrency);
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
     * @dev total supply of zTrueCurrency
     * inherited from FinancialOpportunity.sol
     */
    function totalSupply() external override view returns (uint256) {
        return zTrueCurrencyIssued;
    }

    /**
     * @dev value of TrueCurrency per zTrueCurrency
     * inherited from FinancialOpportunity.sol
     *
     * @return TrueCurrency value of zTrueCurrency
     */
    function tokenValue() external override view returns (uint256) {
        return _tokenValue();
    }

    /**
     * @dev deposit TrueCurrency for zTrueCurrency
     * inherited from FinancialOpportunity.sol
     *
     * @param from address to deposit from
     * @param amount TrueCurrency amount to deposit
     * @return zTrueCurrency amount
     */
    function deposit(address from, uint256 amount) external override onlyFundsManager returns (uint256) {
        return _deposit(from, amount);
    }

    /**
     * @dev redeem zTrueCurrency for TrueCurrency
     * inherited from FinancialOpportunity.sol
     *
     * @param to address to send trueCurrency to
     * @param amount amount of zTrueCurrency to redeem
     * @return amount of TrueCurrency returned by finOp
     */
    function redeem(address to, uint256 amount) external override onlyFundsManager returns (uint256) {
        return _redeem(to, amount);
    }

    /**
     * @dev Get TrueCurrency to be awarded to staking pool
     * Calculated as the difference in value of total zTrueCurrency and yTrueCurrency
     * (finOpTotalSupply * finOpTokenValue) - (zTrueCurrencyIssued * zTrueCurrencyTokenValue)
     *
     * @return pool balance in TrueCurrency
     */
    function poolAwardBalance() public view returns (uint256) {
        uint256 zTrueCurrencyValue = finOp().tokenValue().mul(finOp().totalSupply()).div(10**18);
        uint256 yTrueCurrencyValue = _totalSupply().mul(_tokenValue()).div(10**18);
        return zTrueCurrencyValue.sub(yTrueCurrencyValue);
    }

    /**
     * @dev Sell yTrueCurrency for TrueCurrency and deposit into staking pool.
     * Award amount is the difference between zTrueCurrency issued an
     * yTrueCurrency in the underlying financial opportunity
     */
    function awardPool() external {
        uint256 amount = poolAwardBalance();
        uint256 ytrueCurrency = _yTrueCurrency(amount);

        // sell pool debt and award TrueCurrency to pool
        (bool success, uint256 returnedAmount) = _attemptRedeem(address(this), ytrueCurrency);

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
     * @dev Get supply amount of zTrueCurrency issued
     * @return zTrueCurrency issued
     **/
    function _totalSupply() internal view returns (uint256) {
        return zTrueCurrencyIssued;
    }

    /**
     * Calculate yTrueCurrency / zTrueCurrency (opportunity value minus pool award)
     * We assume opportunity tokenValue always goes up
     *
     * @return value of zTrueCurrency
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
     * @dev calculate TrueCurrency value of zTrueCurrency
     * zTrueCurrency = yTrueCurrency ^ (rewardBasis / totalBasis)
     * reward ratio = _rewardBasis / TOTAL_BASIS
     *
     * @param _rewardBasis reward basis (max TOTAL_BASIS)
     * @return zTrueCurrency token value
     */
    function _calculateTokenValue(uint32 _rewardBasis) internal view returns (uint256) {
        (uint256 result, uint8 precision) = exponents().power(finOp().tokenValue(), 10**18, _rewardBasis, TOTAL_BASIS);
        return result.mul(10**18).div(2**uint256(precision));
    }

    /**
     * @dev Deposit TrueCurrency into wrapped opportunity.
     * Calculate zTrueCurrency value and add to issuance value.
     *
     * @param _account account to deposit trueCurrency from
     * @param _amount amount of trueCurrency to deposit
     */
    function _deposit(address _account, uint256 _amount) internal returns (uint256) {
        token().transferFrom(_account, address(this), _amount);

        // deposit TrueCurrency into opportunity
        token().approve(finOpAddress, _amount);
        finOp().deposit(address(this), _amount);

        // calculate zTrueCurrency value of deposit
        uint256 zTrueCurrency = _amount.mul(10**18).div(_tokenValue());

        // update zTrueCurrencyIssued
        zTrueCurrencyIssued = zTrueCurrencyIssued.add(zTrueCurrency);
        emit Deposit(_account, _amount, zTrueCurrency);
        return zTrueCurrency;
    }

    /**
     * @dev Redeem zTrueCurrency for TrueCurrency
     * Liquidate if opportunity fails to return TrueCurrency.
     *
     * @param _to address to withdraw to
     * @param zTrueCurrency amount in ytrueCurrency to redeem
     * @return TrueCurrency amount redeemed for zTrueCurrency
     */
    function _redeem(address _to, uint256 zTrueCurrency) internal returns (uint256) {
        // attempt withdraw to this contract
        // here we redeem zTrueCurrency amount which leaves
        // a small amount of yTrueCurrency left in the finOp
        // which can be redeemed by the assurance pool
        (bool success, uint256 returnedAmount) = _attemptRedeem(address(this), zTrueCurrency);

        // calculate reward amount
        // todo feewet: check if expected amount is correct
        // possible use precision threshold or smart rounding
        // to eliminate micro liquidations
        uint256 expectedAmount = _tokenValue().mul(zTrueCurrency).div(10**18);
        uint256 liquidated = 0;

        if (!success || (returnedAmount.add(TOLERANCE) < expectedAmount)) {
            liquidated = _liquidate(address(this), int256(expectedAmount.sub(returnedAmount)));
        }

        zTrueCurrencyIssued = zTrueCurrencyIssued.sub(zTrueCurrency, "not enough supply");

        // transfer token to redeemer
        require(token().transfer(_to, returnedAmount.add(liquidated)), "transfer failed");

        emit Redemption(_to, zTrueCurrency, returnedAmount);
        return returnedAmount;
    }

    /**
     * @dev Try to redeem and return success and amount
     *
     * @param _to redeemer address
     * @param zTrueCurrency amount in zTrueCurrency
     **/
    function _attemptRedeem(address _to, uint256 zTrueCurrency) internal returns (bool, uint256) {
        // attempt to withdraw from opportunity
        try finOp().redeem(_to, zTrueCurrency) returns (uint256 fundsWithdrawn) {
            return (true, fundsWithdrawn);
        } catch (bytes memory) {
            return (false, 0);
        }
    }

    /**
     * @dev Liquidate tokens in staking pool to cover debt
     * Sends trueCurrency to receiver
     *
     * @param _receiver address to receive trueCurrency
     * @param _debt trueCurrency debt to be liquidated
     * @return amount liquidated
     **/
    function _liquidate(address _receiver, int256 _debt) internal returns (uint256) {
        liquidator().reclaim(_receiver, _debt);
        emit Liquidation(_receiver, _debt);
        return uint256(_debt);
    }

    /**
     * @dev convert trueCurrency value into yTrueCurrency value
     * @param _trueCurrency TrueCurrency to convert
     * @return yTrueCurrency value of TrueCurrency
     */
    function _yTrueCurrency(uint256 _trueCurrency) internal view returns (uint256) {
        return _trueCurrency.mul(10**18).div(finOp().tokenValue());
    }

    /**
     * @dev convert trueCurrency value into zTrueCurrency value
     * @param _trueCurrency TrueCurrency to convert
     * @return zTrueCurrency value of TrueCurrency
     */
    function _zTrueCurrency(uint256 _trueCurrency) internal view returns (uint256) {
        return _trueCurrency.mul(10**18).div(_tokenValue());
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
