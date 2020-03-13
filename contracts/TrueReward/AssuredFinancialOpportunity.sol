pragma solidity ^0.5.13;

import "./FinancialOpportunity.sol";
import "../../trusttokens/contracts/Liquidator.sol";
import "../../trusttokens/contracts/StakingAsset.sol";
import { FractionalExponents } from "../utilities/FractionalExponents.sol";

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
 * - rewards split tests
 * - implement exponent library
 * - add requires & asserts
 * - handle case where assurance pool is insolvent **
 * - test floating point calculations
 * - renaming TrustToken contracts
 * - make contract upgradeable **

- proxy smart contract "upgradable proxy pattern"
 -> fallback function
 -> send your call to the actual implementation
 -> unlimited number of meta functions
 -> upgrade implementation to new address
 -> give ownership of proxy

 * - bundle unsoldDebt into pool reward
 * - factory pattern 
 * - creators configure a certain amount of things
 * - keep registry of financial opportunities
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
    uint256 lastPerTokenValue = 1; // track last per token value
    uint256 assuranceBasis = 3000; // basis for insurance split. 100 = 1%
    uint256 totalBasis = 10000; // total basis points

    address owner;
    address opportunityAddress;
    address assuranceAddress;
    address liquidatorAddress;

    FractionalExponents.Data private _fractionalExponents;

    // todo feewet onlyOwner
    // should we pass assurance basis here
    constructor(address _opportunityAddress, address _assuranceAddress, address _liquidatorAddress) public {
        owner = msg.sender;
        opportunityAddress = _opportunityAddress;
        assuranceAddress = _assuranceAddress;
        liquidatorAddress = _liquidatorAddress;
    }

    function deposit(address _account, uint _amount) external returns(uint) {
        return _deposit(_account, _amount);
    }

    function perTokenValue() external view returns(uint) {
        return _perTokenValue();
    }

    function widthdrawTo(address _to, uint _amount) external returns(uint) {
        return _widthdrawTo(_to, _amount);
    }

    function widthdrawAll(address _to) external returns(uint) {
        return _widthdrawAll(_to);
    }

    /** Deposit TUSD into wrapped opportunity **/
    function _deposit(address _account, uint _amount) internal returns(uint) {
        opportunityAmount = opportunity().deposit(_account, _amount);
        balance = balance.add(_amount);
        return balance;
    }

    /** Calculate per token value minus assurance pool reward **/
    function _perTokenValue() internal view returns(uint) {
        // this might be really expensive, how can we optimize?
        // opportunity().perTokenValue() ** 0.7
        // (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision
        return FractionalExponents.power(
            opportunity().perTokenValue(), 1, totalBasis - assuranceBasis, totalBasis, 18);
    }

    /** Widhdraw amount of TUSD to an address. Liquidate if opportunity fails to return TUSD. **/
    function _widthdrawTo(address _to, uint _amount) internal returns(uint) {
        // todo feewet we might need to check that user has the right balance here
        // does this mean we need account? Or do we have whatever calls this check

        // attmept widthdraw
        (bool success, uint returnedAmount) = _attemptWidthdrawTo(_to, _amount);

        // todo feewet - do we want to check if a txn returns 0 as well?
        // or returnedAmount < _amount
        if (success) {
            updatePoolAward();
            balance = balance.sub(_amount);
            emit widthdrawToSuccess(_from, _to, _amount);
        }
        else {
            // widthdrawal failed! liquidate :(
            emit widthdrawToFailure(_from, _to, _amount);

            // todo feewet make sure conversion is accurate
            int256 liquidateAmount = int256(_amount); 
            _liquidate(_to, liquidateAmount); // todo feewet check if liquidation succeeds
            returnedAmount = _amount;
        }

        return returnedAmount; // todo feewet do we want returnedAmount or _amount
    }

    /** Widthdraw all TUSD to an account. Liquidate if opportunity fails to return TUSD. **/
    function _widthdrawAll(address _to) internal returns(uint) {
        // todo feewet: need to get actual amount. So this won't work as-is

        // attempt widthdraw
        (bool success, uint returnedAmount) = _attemptWidthdrawAll(_to);

        if (success) {
            updatePoolAward();
            emit widthdrawAllSuccess(_to); // todo feewet: sync with
        }
        else {
            // widthdrawal reverted! liquidate :(
            emit widthdrawAllFailure(_to);
            // todo feewet get account value and pass to liquidation
            int256 accountBalance = 1;
            returnedAmount = _liquidate(_account, accountBalance);
            returnedAmount = uint(accountBalance);
        }
        return returnedAmount;
    }

    /** Liquidate some amount of staked token and send tUSD to reciever **/
    function _liquidate(address _reciever, int256 _debt) internal returns (uint) {
        // assurance().canLiquidate(_debt);
        // todo feewet: handle situation where staking pool is empty.
        // we also need to make sure the trueRewardBackedToken handles this correctly
        // do we need to re-calculate pool award here

        liquidator().reclaim(_reciever, _debt);
        balance = balance.sub(_debt);
        emit stakeLiquidated(_reciever, _debt);
        // we need to return amount, not zero
        return 0;
    }

    /** Sell yTUSD for TUSD and deposit into staking pool **/
    function awardPool() external {
        require(poolAward > 0, "pool award must be greater than zero");

        // sell pool debt and award to pool
        success, returnedAmount = _attemptWidthdrawTo(assuracnceAddress, poolAward);
        balance.sub(returnedAmount);
        emit awardPoolSuccess(poolAward);
        poolAward = 0;
    }

    /** 
     * Update pool award. Prevent pool from widthdrawing more than it should get
     * by checking against the last per token value fetched
    **/
    function updatePoolAward() internal {
        newValue = opportunity().perTokenValue();
        if (newValue > lastPerTokenValue) {
            // calculate unpaid difference in yTUSD
            unpaidValue = newValue - perTokenValue(); // 30% of opportunity().perTokenValue()
            // update poolAward yTUSD balance
            poolAward = poolAward.add(unpaidValue * balance);
            lastPerTokenValue = newValue;
        }
    }

    /** 
     * Attempt to sell yTUSD purchased by assurer
     * this function allows us to sell defaulted debt purchased by the assurance pool
     * ideally we want to eventually exchange this for TrustToken
    **/
    function sellDebt() external {
        // attempt widthdraw to assurance address (will deposit in TokenFallback)
        (bool success, uint returnedAmount) = _attemptWidthdrawTo(assuranceAddress);
        if (success) {
            emit sellDebtSuccess(returnedAmount);
        }
        else { 
            emit sellDebtFailure(0);
        }
    }

    /** Try to widthdrawAll and return success and amount **/
    function _attemptWidthdrawAll(address _account) internal returns (bool, uint) {
        uint returnedAmount;

        // todo

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
    function _attemptWidthdrawTo(address _from, address _to, uint _amount) internal returns (bool, uint) {
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