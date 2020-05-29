pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueUSD.sol";
import "./IAToken.sol";
import "./ILendingPool.sol";
import "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import "./FinancialOpportunity.sol";
import "./ILendingPoolCore.sol";
import "../TrueCurrencies/modularERC20/InstantiatableOwnable.sol";
import { SafeMath } from "openzeppelin-solidity/contracts/math/SafeMath.sol";

/**
 * @title AaveFinancialOpportunity
 * @dev Financial Opportunity to earn TrueUSD with Aave
 *
 * -- Overview --
 * This contract acts as an intermediary between TrueUSD and Aave
 * Tokens are pooled here and balances are kept track in TrueUSD
 * This contract is deployed behind a proxy and is owned by TrueUSD
 * 
 * -- yTUSD and aTokens
 * yTUSD represents a share in the financial opportunity pool
 * aTokens are Aave tokens and increase in value as interest is earned
 *
 * -- tokenValue --
 * tokenValue is the value of 1 yTUSD
 * tokenValue is caluclated using reverseNormalizedIncome
 * We assume tokenValue never decreases
 */
contract AaveFinancialOpportunity is FinancialOpportunity, InstantiatableOwnable {
    using SafeMath for uint256;

    /** aTUSD token contract from AAVE */
    IAToken public aToken;

    /** LendingPool contract from AAVE */
    ILendingPool public lendingPool;

    /** TrueUSD */
    TrueUSD public token;

    /** total number of yTokens issed **/
    uint256 _totalSupply;

    modifier onlyProxyOwner() {
        require(msg.sender == proxyOwner(), "only proxy owner");
        _;
    }

    /**
     * @dev Set up Aave Opportunity
     * Called by TrueUSD
     */
    function configure(
        IAToken _aToken,            // aToken
        ILendingPool _lendingPool,  // lendingPool interface
        TrueUSD _token,             // TrueUSD
        address _owner              // owner
    ) public onlyProxyOwner {
        require(address(_aToken) != address(0), "aToken cannot be address(0)");
        require(address(_lendingPool) != address(0), "lendingPool cannot be address(0)");
        require(address(_token) != address(0), "TrueUSD cannot be address(0)");
        require(_owner != address(0), "Owner cannot be address(0)");
        aToken = _aToken;
        lendingPool = _lendingPool;
        token = _token;
        owner = _owner;
    }

    /**
     * @dev get proxy owner
     */
    function proxyOwner() public view returns(address) {
        return OwnedUpgradeabilityProxy(address(this)).proxyOwner();
    }

    /**
     * Exchange rate between TUSD and yTUSD
     * @return TUSD / yTUSD price ratio (18 decimals of percision)
     */
    function tokenValue() public view returns(uint256) {
        ILendingPoolCore core = ILendingPoolCore(lendingPool.core());
        return core.getReserveNormalizedIncome(address(token)).div(10**(27-18));
    }

    /**
     * @dev get yTUSD issued by this opportunity
     * @return total yTUSD supply
    **/
    function totalSupply() public view returns(uint256) {
        return _totalSupply;
    }

    /**
     * @dev get aToken balance of this contract
     * @return aToken balance of this contract
     */
    function aTokenBalance() public view returns(uint256) {
        return aToken.balanceOf(address(this));
    }

    /**
     * @dev get TUSD balance of this contract
     * @return TUSD balance of this contract
     */
    function tusdBalance() public view returns(uint256) {
        return token.balanceOf(address(this));
    }

    /** 
     * @dev Return value of stake in yTUSD
     */
    function getValueInStake(uint256 _amount) public view returns(uint256) {
        return _amount.mul(10**18).div(tokenValue());
    }

    /**
    * @dev deposits TrueUSD into AAVE using transferFrom
    * @param from account to transferFrom TUSD
    * @param amount amount in TUSD to deposit to AAVE
    * @return yTUSD minted from this deposit
    */
    function deposit(address from, uint256 amount) external onlyOwner returns(uint256) {
        require(token.transferFrom(from, address(this), amount), "transfer from failed");
        require(token.approve(address(lendingPool.core()), amount), "approve failed");

        // calculate balance before, deposit, calculate balance after
        uint256 balanceBefore = aTokenBalance();
        lendingPool.deposit(address(token), amount, 0);
        uint256 balanceAfter = aTokenBalance();

        uint256 yTUSDAmount = getValueInStake(balanceAfter.sub(balanceBefore));

        // increase yTUSD supply
        _totalSupply = _totalSupply.add(yTUSDAmount);

        // return value in yTUSD created from this deposit
        return yTUSDAmount;
    }

    /** 
     * @dev Helper to withdraw TUSD from Aave 
     * aToken redemption amount is equal to yTUSD * tokenValue
     * @param _to address to transfer TUSD to
     * @param _amount amount in yTUSD to redeem
     */
    function _redeem(address _to, uint256 _amount) internal returns(uint256) {
        // calculate amount in TUSD
        uint tusdAmount = _amount.mul(tokenValue()).div(10**18);

        // get balance before, redeem, get balance after
        uint256 balanceBefore = tusdBalance();
        aToken.redeem(tusdAmount);
        uint256 balanceAfter = tusdBalance();

        // calculate TUSD withdrawn
        uint256 fundsWithdrawn = balanceAfter.sub(balanceBefore);

        // sub yTUSD supply
        _totalSupply = _totalSupply.sub(_amount);

        // transfer to recipient and return amount withdrawn
        require(token.transfer(_to, fundsWithdrawn), "transfer failed");

        return fundsWithdrawn;
    }

    /**
     * @dev Withdraw from Aave to _to account
     * @param to account withdarw TUSD to
     * @param amount amount of yTUSD to redeem
     * @return TUSD amount returned from redeem
     */
    function redeem(address to, uint256 amount) external onlyOwner returns(uint256) {
        return _redeem(to, amount);
    }

    /**
     * @dev Redeem all yTUSD Withdraws all TUSD from AAVE
     * @param to account withdarw TUSD to
     * @return TUSD amount returned from redeem
     */
    function redeemAll(address to) external onlyOwner returns(uint256) {
        return _redeem(to, totalSupply());
    }

    function() external payable {
    }
}
