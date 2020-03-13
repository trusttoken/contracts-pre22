pragma solidity ^0.5.13;

import "./FinancialOpportunity.sol";
import "../../trusttokens/contracts/Liquidator.sol";
import "../../trusttokens/contracts/StakingAsset.sol";
//import { FractionalExponents } from "./utilities/FractionalExponents.sol";
import "./utilities/FractionalExponents.sol";
import { SafeMath } from "../TrueCurrencies/Admin/TokenController.sol";

/**
 * AssuredFinancialOpportunity
 *
 * Wrap financial opportunity with Assurance Pool.
 * TUSD is never held in this contract, only zTUSD which represents value we owe.
 * When zTUSD is exchanged, the resulting TUSD is always sent to a reciever.
 * If a transfer fails, stake is sold from the staking pool for TUSD.
 * When stake is liquidated, the TUSD is sent out in the same transaction (Flash Assurance).
 * Can attempt to sell bad debt at a later date and return value to the pool.
 * Keeps track of rewards stream for assurance pool.
 *
**/
contract AssuredFinancialOpportunity is FinancialOpportunity {
    event withdrawToSuccess(address _to, uint _amount);
    event withdrawAllSuccess(address _account);
    event withdrawToFailure(address _to, uint _amount);
    event withdrawAllFailure(address _account);
    event stakeLiquidated(address _reciever, int256 _debt);
    event awardPoolSuccess(uint256 _amount);

    uint256 constant ASSURANCE_BASIS = 3000; // basis for insurance split. 100 = 1%
    uint256 constant TOTAL_BASIS = 10000; // total basis points
    uint zTUSDIssued = 0; // how much zTUSD we've issued

    address opportunityAddress;
    address assuranceAddress;
    address liquidatorAddress;
    address exponentContractAddress;

    using SafeMath for uint;
    using SafeMath for uint32;
    using SafeMath for uint256;

    constructor(address _opportunityAddress, address _assuranceAddress, address _liquidatorAddress) public {
        opportunityAddress = _opportunityAddress;
        assuranceAddress = _assuranceAddress;
        liquidatorAddress = _liquidatorAddress;
    }

    /** 
     * Get total amount of zTUSD issued
    **/
    function _getBalance() internal view returns (uint) {
        return zTUSDIssued;
    }

    /** 
     * Deposit TUSD into wrapped opportunity. Calculate zTUSD value and add to issuance value.
    **/
    function _deposit(address _account, uint _amount) internal returns(uint) {
        // deposit TUSD
        uint opportunityAmount = opportunity().deposit(_account, _amount);

        // calculate zTUSD value of deposit
        uint zTUSDValue = zTUSDIssued.add(_amount.div(_perTokenValue()));

        // calculate new zTUSDIssued
        zTUSDIssued = zTUSDIssued.add(zTUSDValue);
        return zTUSDValue;
    }

    /** 
     * Calculate TUSD / zTUSD (opportunity value minus pool award)
     * todo feewet: this might be really expensive, how can we optimize? (cache)
    **/
    function _perTokenValue() internal view returns(uint256) {
        // (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision
        (uint256 result, uint8 precision) = exponents().power(
            opportunity().perTokenValue(), 1, uint32(TOTAL_BASIS.sub(ASSURANCE_BASIS)), uint32(TOTAL_BASIS));
    }

    /** 
     * Withdraw amount of TUSD to an address. Liquidate if opportunity fails to return TUSD. 
     * todo feewet we might need to check that user has the right balance here
     * does this mean we need account? Or do we have whatever calls this check
    **/
    function _withdrawTo(address _to, uint _amount) internal returns(uint) {

        // attmept withdraw
        (bool success, uint returnedAmount) = _attemptWithdrawTo(_to, _amount);

        // todo feewet - check returnedAmount >= _amount
        if (success) {
            emit withdrawToSuccess(_to, _amount);
        }
        else {
            // withdrawal failed! liquidate :(
            emit withdrawToFailure(_to, _amount);

            // todo feewet make sure conversion is accurate
            int256 liquidateAmount = int256(_amount); 
            _liquidate(_to, liquidateAmount); // todo feewet check if liquidation succeeds
            returnedAmount = _amount;
        }

        // calculate new amount issued
        zTUSDIssued = zTUSDIssued.sub(_amount.div(_perTokenValue()));

        return returnedAmount; // todo feewet do we want returnedAmount or _amount
    }

    /** 
     * Try to withdrawTo and return success and amount 
    **/
    function _attemptWithdrawTo(address _to, uint _amount) internal returns (bool, uint) {
        uint returnedAmount;

        // attempt to withdraw from oppurtunity
        (bool success, bytes memory returnData) =
            address(opportunity()).call(
                abi.encodePacked(opportunity().withdrawTo.selector, abi.encode(_to, _amount))
            );

        if (success) { // successfully got TUSD :)
            returnedAmount = abi.decode(returnData, (uint));
            success = false;
        }
        else { // failed get TUSD :(
            success = false;
            returnedAmount = 0;
        }
        return (success, returnedAmount);
    }

    /** 
     * Liquidate staked tokens to pay for debt.
     * todo feewet: handle situation where staking pool is empty.
    **/
    function _liquidate(address _reciever, int256 _debt) internal returns (uint) {
        liquidator().reclaim(_reciever, _debt);
        emit stakeLiquidated(_reciever, _debt);
        return uint(_debt);
    }

    /** 
     * Sell yTUSD for TUSD and deposit into staking pool.
    **/
    function awardPool() external {
        // compute what is owed in TUSD
        uint awardAmount = opportunity().perTokenValue() * opportunity().getBalance() - _getBalance() * _perTokenValue();

        // sell pool debt and award TUSD to pool
        (bool success, uint returnedAmount) = _attemptWithdrawTo(assuranceAddress, awardAmount);
        emit awardPoolSuccess(returnedAmount);
    }

    function deposit(address _account, uint _amount) external returns(uint) {
        return _deposit(_account, _amount);
    }

    function withdrawTo(address _to, uint _amount) external returns(uint) {
        return _withdrawTo(_to, _amount);
    }

    // todo feewet remove from interface
    function withdrawAll(address _to) external returns(uint) {
        return _withdrawTo(_to, _getBalance());
    }

    function getBalance() external view returns (uint) {
        return _getBalance();
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
}