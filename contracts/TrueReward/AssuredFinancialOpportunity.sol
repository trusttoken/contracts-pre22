pragma solidity ^0.5.13;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@trusttoken/trusttokens/contracts/Liquidator.sol";
import "@trusttoken/trusttokens/contracts/StakingAsset.sol";
import "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import "./utilities/FractionalExponents.sol";
import "./FinancialOpportunity.sol";

/**
 * AssuredFinancialOpportunity
 *
 * Wrap financial opportunity with Assurance.
 * TUSD is never held in this contract, only zTUSD which represents value we owe.
 * When zTUSD is exchanged, the resulting TUSD is always sent to a recipient.
 * If a transfer fails, stake is sold from the staking pool for TUSD.
 * When stake is liquidated, the TUSD is sent out in the same transaction (Flash Assurance).
 * Can attempt to sell bad debt at a later date and return value to the pool.
 * Keeps track of rewards stream for assurance pool.
 *
**/
contract AssuredFinancialOpportunity is FinancialOpportunity, OwnedUpgradeabilityProxy {
    event depositSuccess(address _account, uint amount);
    event withdrawToSuccess(address _to, uint _amount);
    event withdrawToFailure(address _to, uint _amount);
    event stakeLiquidated(address _reciever, int256 _debt);
    event awardPoolSuccess(uint256 _amount);
    event awardPoolFailure(uint256 _amount);

    uint32 constant REWARD_BASIS = 1000; // basis for insurance split. 1000 for MVP
    uint32 constant TOTAL_BASIS = 1000; // total basis points
    uint zTUSDIssued = 0; // how much zTUSD we've issued
    address opportunityAddress;
    address assuranceAddress;
    address liquidatorAddress;
    address exponentContractAddress;
    address trueRewardBackedTokenAddress;

    using SafeMath for uint;
    using SafeMath for uint32;
    using SafeMath for uint256;

    function perTokenValue() external view returns(uint256) {
        return _perTokenValue();
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

    function token() internal view returns (IERC20){
        return IERC20(trueRewardBackedTokenAddress);
    }

    /** 
     * Calculate TUSD / zTUSD (opportunity value minus pool award)
     * We assume opportunity perTokenValue always goes up
     * todo feewet: this might be really expensive, how can we optimize? (cache by perTokenValue)
     */
    function _perTokenValue() internal view returns(uint256) {
        // if no assurance, use  opportunity perTokenValue
        if (REWARD_BASIS == TOTAL_BASIS) {
            return opportunity().perTokenValue();
        }

        // otherwise calcualte perTokenValue 
        (uint256 result, uint8 precision) = exponents().power(
            opportunity().perTokenValue(), 10**18,
            REWARD_BASIS, TOTAL_BASIS);
        return result.mul(10**18).div(2 ** uint256(precision));
    }

    /** 
     * Get total amount of zTUSD issued
    **/
    function _getBalance() internal view returns (uint) {
        return zTUSDIssued;
    }

    /**
     * @dev configure assured opportunity
     */
    function configure(
        address _opportunityAddress, 
        address _assuranceAddress, 
        address _liquidatorAddress,
        address _exponentContractAddress,
        address _trueRewardBackedTokenAddress
    )
    public onlyProxyOwner {
        opportunityAddress = _opportunityAddress;
        assuranceAddress = _assuranceAddress;
        liquidatorAddress = _liquidatorAddress;
        exponentContractAddress = _exponentContractAddress;
        trueRewardBackedTokenAddress = _trueRewardBackedTokenAddress;
    }

    modifier onlyToken() {
        require(msg.sender == trueRewardBackedTokenAddress, "only token");
        _;
    }

    function claimLiquidatorOwnership() external onlyProxyOwner {
        liquidator().claimOwnership();
    }

    function transferLiquidatorOwnership(address newOwner) external onlyProxyOwner {
        liquidator().transferOwnership(newOwner);
    }

    /**
     * Deposit TUSD into wrapped opportunity. Calculate zTUSD value and add to issuance value.
     */
    function _deposit(address _account, uint _amount) internal returns(uint) {
        token().transferFrom(_account, address(this), _amount);

        // deposit TUSD into opportunity
        token().approve(opportunityAddress, _amount);
        opportunity().deposit(address(this), _amount);

        // calculate zTUSD value of deposit
        uint zTUSDValue = zTUSDIssued.add(_amount.mul(10 ** 18).div(_perTokenValue()));

        // update zTUSDIssued
        zTUSDIssued = zTUSDIssued.add(zTUSDValue);
        emit depositSuccess(_account, _amount);
        return zTUSDValue;
    }

    /**
     * Withdraw amount of TUSD to an address. Liquidate if opportunity fails to return TUSD. 
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
            emit withdrawToFailure(_to, _amount);

            int256 liquidateAmount = int256(_amount);
            bool canLiquidate = _canLiquidate(_amount);
            if (canLiquidate) {
                _liquidate(_to, liquidateAmount);
                returnedAmount = _amount;
            } else {
                emit withdrawToFailure(_to, _amount);
                returnedAmount = 0;
            }
        }

        // calculate new amount issued
        zTUSDIssued = zTUSDIssued.sub(returnedAmount.div(_perTokenValue()));

        return returnedAmount;
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
            success = true;
        }
        else { // failed get TUSD :(
            success = false;
            returnedAmount = 0;
        }
        return (success, returnedAmount);
    }

    /**
     * Liquidate staked tokens to pay for debt.
    **/
    function _liquidate(address _reciever, int256 _debt) internal returns (uint) {
        liquidator().reclaim(_reciever, _debt);
        emit stakeLiquidated(_reciever, _debt);
        return uint(_debt);
    }

    /** 
     * Return true if assurance pool can liquidate
    **/
    function _canLiquidate(uint _amount) internal returns (bool) {
        //assurance().canLiquidate(_amount);
        return true;
    }

    /** 
     * Sell yTUSD for TUSD and deposit into staking pool.
    **/
    function awardPool() external {
        // compute what is owed in TUSD
        // (opportunityValue * opportunityBalance)
        // - (assuredOpportunityBalance * assuredOpportunityTokenValue)
        uint awardAmount = opportunity().perTokenValue().mul(opportunity().getBalance()).sub(_getBalance().mul(_perTokenValue()));

        // sell pool debt and award TUSD to pool
        (bool success, uint returnedAmount) = _attemptWithdrawTo(assuranceAddress, awardAmount);
        if (success) {
            emit awardPoolSuccess(returnedAmount);
        }
        else {
            emit awardPoolFailure(returnedAmount);
        }
    }

    function deposit(address _account, uint _amount) external onlyToken returns(uint) {
        return _deposit(_account, _amount);
    }

    function withdrawTo(address _to, uint _amount) external onlyToken returns(uint) {
        return _withdraw(_to, _amount);
    }

    function withdrawAll(address _to) external onlyProxyOwner returns(uint) {
        return _withdraw(_to, _getBalance());
    }

    function() external payable {}
}
