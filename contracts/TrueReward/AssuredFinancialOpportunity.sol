pragma solidity ^0.5.13;

import "./FinancialOpportunity.sol";
import "../../trusttokens/contracts/Liquidator.sol";
import "../../trusttokens/contracts/StakingAsset.sol";

/**
 * AssuredFinancialOpportunity
 *
 * Wrap financial opportunity with Assurance Pool.
 * TUSD is never held in this contract, only yTUSD which represents oppurtunity value
 * When yTUSD is exchanged, the resulting tUSD is always sent to a reciever
 * If a transfer fails, stake is sold from the staking pool for TUSD.
 * When stake is liquidated, the TUSD is sent out in the same transaction (Flash Assurance).
 * Can attempt to sell bad debt at a later date and return value to the pool.
 * Keeps track of rewards stream for assurance pool.
 * 
 * todo:
 * - sync with others on event structure
 * - implement exponent library
 * - add requires & asserts
 * - handle case where assurance pool is insolvent
 * - test floating point calculations
 * - renaming TrustToken contracts
 * - make contract upgradeable
 * - decide whether to add a constructor or hard code other contract addr
 * 
**/
contract AssuredFinancialOpportunity is FinancialOpportunity {
    // todo feewet: do we need these failure events or should we just emit liquidation
    event widthdrawToSuccess(address _from, address _to, uint _amount);
    event widthdrawAllSuccess(address _account);
    event widthdrawToFailure(address _from, address _to, uint _amount);
    event widthdrawAllFailure(address _account);
    event stakeLiquidated(address _reciever, int256 _debt);
    event awardPoolSuccess(uint256 _amount);
    event sellDebtSuccess(uint256 _amount);
    event sellDebtFailure(uint256 _amount);
    event assuranceFailure(); // todo feewet handle insolvent assurer

    uint256 balance; // in yTUSD
    uint256 poolAward; // in yTUSD
    uint256 unsoldDebt; // in yTUSD
    uint256 assuranceBasis = 3000; // basis for insurance split. 100 = 1%

    address owner;
    address opportunityAddress;
    address assuranceAddress;
    address liquidatorAddress;

    // todo feewet onlyOwner
    constructor(address _opportunityAddress, address _assuranceAddress, address _liquidatorAddress) public {
        owner = msg.sender;
        opportunityAddress = _opportunityAddress;
        assuranceAddress = _assuranceAddress;
        liquidatorAddress = _liquidatorAddress;
    }

    /** Deposit TUSD into wrapped opportunity **/
    function deposit(address _account, uint _amount) external returns(uint) {
        opportunity().deposit(_account, _amount);
    }

    /** Calculate per token value minus assurance pool reward **/
    function perTokenValue() external view returns(uint) {
        // todo feewet: calculate value based on rewards split
        return opportunity().perTokenValue() * (1 - assuranceBasis);
    }

    /** Widhdraw amount of TUSD to an address. Liquidate if opportunity fails to return TUSD. **/
    function widthdrawTo(address _from, address _to, uint _amount) external returns(uint) {
        // attmept widthdraw
        (bool success, uint returnedAmount) = attemptWidthdrawTo(_from, _to, _amount);

        // todo feewet - do we want to check if a txn returns 0 as well?
        // or returnedAmount < _amount
        if (success) {
            emit widthdrawToSuccess(_from, _to, _amount);
        }
        else {
            // widthdrawal failed! liquidate :(
            emit widthdrawToFailure(_from, _to, _amount);

            // todo feewet make sure conversion is accurate
            int256 liquidateAmount = int256(_amount); 
            liquidate(_to, liquidateAmount); // todo feewet check if liquidation succeeds
            returnedAmount = _amount;
        }

        return returnedAmount; // todo feewet do we want returnedAmount or _amount
    }

    /** Widthdraw all TUSD to an account. Liquidate if opportunity fails to return TUSD. **/
    function widthdrawAll(address _account) external returns(uint) {
        // attempt widthdraw
        (bool success, uint returnedAmount) = attemptWidthdrawAll(_account);

        if (success) {
            emit widthdrawAllSuccess(_account); // todo feewet: sync with
        }
        else {
            // widthdrawal reverted! liquidate :(
            emit widthdrawAllFailure(_account);
            // todo feewet get account value and pass to liquidation
            int256 accountBalance = 1;
            returnedAmount = liquidate(_account, accountBalance);
            returnedAmount = uint(accountBalance);
        }
        return returnedAmount;
    }

    /** Liquidate some amount of staked token and send tUSD to reciever **/
    function liquidate(address _reciever, int256 _debt) internal returns (uint) {
        // todo feewet: handle situation where staking pool is empty.
        // we also need to make sure the trueRewardBackedToken handles this correctly
        liquidator().reclaim(_reciever, _debt);
        emit stakeLiquidated(_reciever, _debt);
        // we need to return amount, not zero
        return 0;
    }

    /** Sell yTUSD for TUSD and deposit into staking pool **/
    function awardPool() external {
        require(poolAward > 0, "assurance pool must have positive balance");
        assurance().award(poolAward);
        emit awardPoolSuccess(poolAward);
        poolAward = 0;
    }

    /** 
     * Attempt to sell yTUSD purchased by assurer
     * this function allows us to sell defaulted debt purchased by the assurance pool
     * ideally we want to eventually exchange this for TrustToken
    **/
    function sellDebt() external {
        // attempt widthdraw to assurance address (will deposit in TokenFallback)
        (bool success, uint returnedAmount) = attemptWidthdrawAll(assuranceAddress);

        if (success) { 
            emit sellDebtSuccess(returnedAmount);
        } 
        else { 
            emit sellDebtFailure(0);
        }
    }

    /** Try to widthdrawAll and return success and amount **/
    function attemptWidthdrawAll(address _account) internal returns (bool, uint) {
        uint returnedAmount;

        // attempt to widthdraw from oppurtunity
        (bool success, bytes memory returnData) =
            address(opportunity()).call(
                abi.encodePacked(opportunity().withdrawAll.selector, abi.encode(_account))
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

    /** Try to widthdrawTo and return success and amount **/
    function attemptWidthdrawTo(address _from, address _to, uint _amount) internal returns (bool, uint) {
        uint returnedAmount;

        // attempt to widthdraw from oppurtunity
        (bool success, bytes memory returnData) =
            address(opportunity()).call(
                abi.encodePacked(opportunity().withdrawTo.selector, abi.encode(_from, _to, _amount))
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
    
    function opportunity() internal view returns(FinancialOpportunity) {
        return FinancialOpportunity(opportunityAddress);
    }

    function assurance() internal view returns(StakedToken) {
        // todo feewet rename StakedToken to AssuranceOpportunity/Pool
        return StakedToken(assuranceAddress);
    }

    function liquidator() internal view returns (Liquidator) {
        return Liquidator(liquidatorAddress);
    }
}