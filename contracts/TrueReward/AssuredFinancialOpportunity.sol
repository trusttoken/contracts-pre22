pragma solidity ^0.5.13;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@trusttoken/trusttokens/contracts/Liquidator.sol";
import "@trusttoken/trusttokens/contracts/StakedToken.sol";
import "../TrueCurrencies/AssuredFinancialOpportunityStorage.sol";
import "../TrueCurrencies/modularERC20/InitializableClaimable.sol";
import "./utilities/FractionalExponents.sol";
import "../TrueCurrencies/AssuredFinancialOpportunityStorage.sol";
import "../TrueCurrencies/modularERC20/InitializableClaimable.sol";
import "./FinancialOpportunity.sol";

/**
 * @title AssuredFinancialOpportunity
 * @dev Wrap financial opportunity with Assurance
 *
 * -- Overview -- 
 * Rewards are earned as perTokenValue() increases in the underlying opportunity
 * TUSD is never held in this contract - zTUSD represents value we owe to depositors
 *
 * -- zTUSD vs yTUSD --
 * zTUSD represents an amount of ASSURED TUSD owed to the zTUSD holder (depositors)
 * 1 zTUSD = AssuranceOpportunity perTokenValue() = (yTUSD ^ assurance ratio)
 * yTUSD represents an amount of NON-ASSURED TUSD owed to this contract
 * 1 yTUSD = FinancialOpportunity perTokenValue()
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
 * perTokenValue can never decrease for this contract. We want to guarantee
 * the awards earned on deposited TUSD and liquidate trusttokens for this amount
 * We allow the rewardBasis to be adjusted, but since we still need to maintain
 * the perTokenValue, we calculate an adjustment factor and set minPerTokenValue
 *
**/
contract AssuredFinancialOpportunity is FinancialOpportunity, AssuredFinancialOpportunityStorage, InitializableClaimable {
    event depositSuccess(address _account, uint amount);
    event withdrawToSuccess(address _to, uint _amount);
    event stakeLiquidated(address _reciever, int256 _debt);
    event awardPoolSuccess(uint256 _amount);
    event awardPoolFailure(uint256 _amount);

    // external contracts
    address opportunityAddress;
    address assuranceAddress;
    address liquidatorAddress;
    address exponentContractAddress;
    address trueRewardBackedTokenAddress;

    // how much zTUSD we've issued (total supply)
    uint zTUSDIssued; 

    // total basis points for pool awards
    uint32 constant TOTAL_BASIS = 1000; 
    
    // percentage of interest for staking pool
    // 1% = 10
    uint32 rewardBasis;

    // adjustment factor used when changing reward basis
    // we change the adjustment factor
    uint adjustmentFactor;

    // minPerTokenValue can never decrease
    uint minPerTokenValue;

    // address allowed to withdraw/deposit, usually set to address of TUSD smart contract
    address fundsManager;

    using SafeMath for uint;
    using SafeMath for uint32;
    using SafeMath for uint256;

    function perTokenValue() external view returns(uint256) {
        return _perTokenValue();
    }

    function getBalance() external view returns (uint) {
        return _getBalance().mul(_perTokenValue()).div(10**18);
    }

    function opportunity() internal view returns(FinancialOpportunity) {
        return FinancialOpportunity(opportunityAddress);
    }

    function assurance() internal view returns(StakedToken) {
        return StakedToken(assuranceAddress); // StakedToken is assurance staking pool
    }

    function liquidator() internal view returns (Liquidator) {
        return Liquidator(liquidatorAddress);
    }

    function exponents() internal view returns (FractionalExponents){
        return FractionalExponents(exponentContractAddress);
    }

    function token() internal view returns (IERC20){
        return IERC20(trueRewardBackedTokenAddress);
    }

    // zTUSD = yTUSD ^ 0.7
    function _calculatePerTokenValue(uint32 _rewardBasis) internal view returns(uint256) {
        (uint256 result, uint8 precision) = exponents().power(
            opportunity().perTokenValue(), 10**18,
            _rewardBasis, TOTAL_BASIS);
        return result.mul(10**18).div(2 ** uint256(precision));
    }

    /**
     * Calculate TUSD / zTUSD (opportunity value minus pool award)
     * We assume opportunity perTokenValue always goes up
     * todo feewet: this might be really expensive, how can we optimize? (cache by perTokenValue)
     */
    function _perTokenValue() internal view returns(uint256) {
        // if no assurance, use  opportunity perTokenValue
        if (rewardBasis == TOTAL_BASIS) {
            return opportunity().perTokenValue();
        }

        uint calculatedValue = _calculatePerTokenValue(rewardBasis).mul(adjustmentFactor).div(10**18);
        if(calculatedValue < minPerTokenValue) {
            return minPerTokenValue;
        } else {
            return calculatedValue;
        }
    }

    /**
     * Get total amount of zTUSD issued
    **/
    function _getBalance() internal view returns (uint) {
        return zTUSDIssued;
    }

    /**
     * Get amount pending to be awarded
     * Calculated as (opportunityValue * opportunityBalance) 
     * - (assuredOpportunityBalance * assuredOpportunityTokenValue)
     */
    function awardAmount() public view returns (uint) {
        uint underlyingTusdValue = opportunity().getBalance();
        uint ownTusdValue = _getBalance().mul(_perTokenValue()).div(10**18);
        return underlyingTusdValue.sub(ownTusdValue);
    }

    /**
     * @dev configure assured opportunity
     */
    function configure(
        address _opportunityAddress,            // finOp to assure
        address _assuranceAddress,              // assurance pool
        address _liquidatorAddress,             // trusttoken liqudiator
        address _exponentContractAddress,       // exponent contract
        address _trueRewardBackedTokenAddress,  // token
        address _fundsManager                   // funds manager
    ) external {
        super._configure(); // sender claims ownership here
        opportunityAddress = _opportunityAddress;
        assuranceAddress = _assuranceAddress;
        liquidatorAddress = _liquidatorAddress;
        exponentContractAddress = _exponentContractAddress;
        trueRewardBackedTokenAddress = _trueRewardBackedTokenAddress;
        fundsManager = _fundsManager;
        rewardBasis = TOTAL_BASIS; // set to 100% by default
        adjustmentFactor = 1*10**18;
    }

    /// funds manager can deposit/withdraw from this opportunity
    modifier onlyFundsManager() {
        require(msg.sender == fundsManager, "only funds manager");
        _;
    }

    function claimLiquidatorOwnership() external onlyOwner {
        liquidator().claimOwnership();
    }

    function transferLiquidatorOwnership(address newOwner) external onlyOwner {
        liquidator().transferOwnership(newOwner);
    }

    /**
     * @dev Deposit TUSD into wrapped opportunity. 
     * Calculate zTUSD value and add to issuance value.
     */
    function _deposit(address _account, uint _amount) internal returns(uint) {
        token().transferFrom(_account, address(this), _amount);

        // deposit TUSD into opportunity
        token().approve(opportunityAddress, _amount);
        opportunity().deposit(address(this), _amount);

        // calculate zTUSD value of deposit
        uint zTUSDValue = _amount.mul(10 ** 18).div(_perTokenValue());

        // update zTUSDIssued
        zTUSDIssued = zTUSDIssued.add(zTUSDValue);
        emit depositSuccess(_account, _amount);
        return zTUSDValue;
    }

    /**
     * @dev Withdraw amount of TUSD to an address. Liquidate if opportunity fails to return TUSD.
     * todo feewet we might need to check that user has the right balance here
     * does this mean we need account? Or do we have whatever calls this check
     */
    function _withdraw(address _to, uint _amount) internal returns(uint) {

        // attmept withdraw
        (bool success, uint returnedAmount) = _attemptWithdrawTo(_to, _amount);

        // todo feewet do we want best effort
        if (success) {
            emit withdrawToSuccess(_to, _amount);
        }
        else {
            // withdrawal failed! liquidate :(
            _liquidate(_to, int256(_amount));
        }

        // calculate new amount issued
        zTUSDIssued = zTUSDIssued.sub(returnedAmount);

        return returnedAmount;
    }

    /**
     * @dev Try to withdrawTo and return success and amount
    **/
    function _attemptWithdrawTo(address _to, uint _amount) internal returns (bool, uint) {
        uint returnedAmount;

        // attempt to withdraw from oppurtunity
        (bool success, bytes memory returnData) = address(opportunity()).call(
            abi.encodePacked(opportunity().withdrawTo.selector, abi.encode(_to, _amount))
        );

        if (success) { // successfully got TUSD :)
            returnedAmount = abi.decode(returnData, (uint));
            success = true;
        }
        else { // failed get TUSD :(
            success = false;
            returnedAmount = 0;
        }
        return (success, returnedAmount);
    }

    /**
     * @dev Liquidate tokens in staking pool to cover debt
    **/
    function _liquidate(address _reciever, int256 _debt) internal returns (uint) {
        liquidator().reclaim(_reciever, _debt);
        emit stakeLiquidated(_reciever, _debt);
        return uint(_debt);
    }

    /**
     * @dev Sell yTUSD for TUSD and deposit into staking pool.
    **/
    function awardPool() external {
        uint amount = awardAmount();

        // sell pool debt and award TUSD to pool
        (bool success, uint returnedAmount) = _attemptWithdrawTo(assuranceAddress, amount);
        if (success) {
            emit awardPoolSuccess(returnedAmount);
        }
        else {
            emit awardPoolFailure(returnedAmount);
        }
    }

    function deposit(address _account, uint _amount) external onlyFundsManager returns(uint) {
        return _deposit(_account, _amount);
    }

    function withdrawTo(address _to, uint _amount) external onlyFundsManager returns(uint) {
        return _withdraw(_to, _amount);
    }

    function withdrawAll(address _to) external onlyOwner returns(uint) {
        return _withdraw(_to, _getBalance().mul(_perTokenValue()).div(10**18));
    }

    /**
     * @dev set new reward basis for opportunity
     * recalculate perTokenValue
     * ensure perTokenValue never decreases
     */
    function setRewardBasis(uint32 _value) external onlyOwner {
        minPerTokenValue = _perTokenValue();

        adjustmentFactor = adjustmentFactor
            .mul(_calculatePerTokenValue(rewardBasis))
            .div(_calculatePerTokenValue(_value));
        rewardBasis = _value;
    }

    function() external payable {}
}
