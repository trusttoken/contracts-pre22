pragma solidity ^0.5.13;

import "./FinancialOpportunity.sol";
import "../../trusttokens/contracts/Liquidator.sol";
import "../../trusttokens/contracts/StakingAsset.sol";

/**
 * AssuredFinancialOpportunity
 *
 * Wrap financial opportunity with Assurance Pool.
 * If a transfer fails, stake is sold from the staking pool for TUSD.
 * When stake is liquidated, the debt is transferred to a pool.
 * Can attempt to sell bad debt at a later date and return value to the pool.
 * Keeps track of rewards stream for assurance pool.
**/
contract AssuredFinancialOpportunity is FinancialOpportunity {
    // todo feewet: do we need these failure events or should we just emit liquidation
    event widthdrawToFailed(address _from, address _to, uint _amount);
    event widthdrawAllFailed(address _account);
    event stakeLiquidated(address _reciever, int256 _debt);
    event poolRewarded(uint256 _amount);
    event debtSold(uint256 _amount);

    uint256 balance; // in yTUSD
    uint256 rewardBalance; // in yTUSD
    uint256 unsoldDebt; // in yTUSD

    address opportunityAddress;
    address assuranceAddress;
    address liquidatorAddress;

    /** Deposit TUSD into wrapped opportunity **/
    function deposit(address _account, uint _amount) external returns(uint) {
        opportunity().deposit(_account, _amount);
    }

    /** Widhdraw amount of TUSD to an address. Liquidate if opportunity fails to return TUSD. **/
    function widthdrawTo(address _from, address _to, uint _amount) external returns(uint) {
        bool returnedBool;
        uint returnedAmount;
        // attempt to widthdraw
        (bool success, bytes memory returnData) =
            address(opportunity()).call(abi.encodePacked(
                opportunity().withdrawTo.selector, abi.encode(_from, _to, _amount)));

        if (success) {
            // successfully got TUSD :)
            (returnedBool, returnedAmount) = abi.decode(returnData, (bool, uint));
        } 
        else {
            // widthdrawal reverted! liquidate :(
            emit widthdrawToFailed(_from, _to, _amount);
            // todo feewet make sure conversion is accurate
            int256 liquidateAmount = int256(_amount);
            returnedAmount = liquidate(_to, liquidateAmount);
        }
        return returnedAmount;
    }

    /** Widthdraw all TUSD to an account. Liquidate if opportunity fails to return TUSD. **/
    function widthdrawAll(address _account) external returns(uint) {
        bool returnedBool;
        uint returnedAmount;
        // attempt to widthdraw
        (bool success, bytes memory returnData) =
            address(opportunity()).call(
                abi.encodePacked(opportunity().withdrawAll.selector, abi.encode(_account))
            );
        if (success) {
            // successfully got TUSD :)
            (returnedBool, returnedAmount) = abi.decode(returnData, (bool, uint));
        } 
        else {
            // widthdrawal reverted! liquidate :(
            emit widthdrawAllFailed(_account);
            // todo feewet get account value and pass to liquidation
            int256 accountBalance = 1;
            returnedAmount = liquidate(_account, accountBalance);
        }
        return returnedAmount;
    }

    /** Calculate per token value minus assurance pool reward **/
    function perTokenValue() external view returns(uint) {
        // todo feewet: calculate value based on rewards split
        return opportunity().perTokenValue();
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

    /** Deposit TUSD into staking pool **/
    function reward(uint256 _amount) external {
        assurance().deposit(_amount);
        emit poolRewarded(_amount);
    }

    /** Attempt to sell yTUSD purchased by assurer **/
    function sellDebt(uint256 _amount) external {
        // todo feewet
        // this function allows
        emit debtSold(_amount);
    }

    /** Financial Opportunity **/
    function opportunity() internal view returns(FinancialOpportunity) {
        return FinancialOpportunity(opportunityAddress);
    }

    /** Assurance Pool **/
    function assurance() internal view returns(StakedToken) {
        // todo feewet rename StakedToken to AssuranceOpportunity
        return StakedToken(assuranceAddress);
    }

    /** Assurance Pool Liquidator **/
    function liquidator() internal view returns (Liquidator) {
        return Liquidator(liquidatorAddress);
    }
}