// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {FinancialOpportunity} from "./FinancialOpportunity.sol";
import {TrueRewardBackedToken} from "../truecurrencies/TrueRewardBackedToken.sol";
import {IAToken} from "./IAToken.sol";
import {ILendingPool} from "./ILendingPool.sol";
import {OwnedUpgradeabilityProxy} from "../truecurrencies/proxy/OwnedUpgradeabilityProxy.sol";
import {ILendingPoolCore} from "./ILendingPoolCore.sol";
import {InstantiatableOwnable} from "../truecurrencies/modularERC20/InstantiatableOwnable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title AaveFinancialOpportunity
 * @dev Financial Opportunity to earn TrueCurrency with Aave
 *
 * -- Overview --
 * This contract acts as an intermediary between TrueCurrency and Aave
 * Tokens are pooled here and balances are kept track in TrueCurrency
 * This contract is deployed behind a proxy and is owned by TrueCurrency
 *
 * -- yTrueCurrency and aTokens
 * yTrueCurrency represents a fixed share in the financial opportunity pool
 * aTokens are Aave tokens and increase in quantity as interest is earned
 *
 * -- tokenValue --
 * tokenValue is the value of 1 yTrueCurrency
 * tokenValue is calculated using reverseNormalizedIncome
 * We assume tokenValue never decreases
 */
contract AaveFinancialOpportunity is FinancialOpportunity, InstantiatableOwnable {
    using SafeMath for uint256;

    /** aToken token contract from AAVE */
    IAToken public aToken;

    /** LendingPool contract from AAVE */
    ILendingPool public lendingPool;

    /** TrueCurrency */
    TrueRewardBackedToken public token;

    /** @dev total number of yTokens issued **/
    uint256 _totalSupply;

    modifier onlyProxyOwner() {
        require(msg.sender == proxyOwner(), "only proxy owner");
        _;
    }

    /**
     * @dev Set up Aave Opportunity
     * Called by TrueCurrency
     */
    function configure(
        IAToken _aToken, // aToken
        ILendingPool _lendingPool, // lendingPool interface
        TrueRewardBackedToken _token, // TrueCurrency
        address _owner // owner
    ) public onlyProxyOwner {
        require(address(_aToken) != address(0), "aToken cannot be address(0)");
        require(address(_lendingPool) != address(0), "lendingPool cannot be address(0)");
        require(address(_token) != address(0), "TrueCurrency cannot be address(0)");
        require(_owner != address(0), "Owner cannot be address(0)");
        aToken = _aToken;
        lendingPool = _lendingPool;
        token = _token;
        owner = _owner;
    }

    /**
     * @dev get proxy owner
     */
    function proxyOwner() public view returns (address) {
        return OwnedUpgradeabilityProxy(address(this)).proxyOwner();
    }

    /**
     * Exchange rate between TrueCurrency and yTrueCurrency
     * @return TrueCurrency / yTrueCurrency price ratio (18 decimals of precision)
     */
    function tokenValue() public override view returns (uint256) {
        ILendingPoolCore core = ILendingPoolCore(lendingPool.core());
        return core.getReserveNormalizedIncome(address(token)).div(10**(27 - 18));
    }

    /**
     * @dev get yTrueCurrency issued by this opportunity
     * @return total yTrueCurrency supply
     **/
    function totalSupply() public override view returns (uint256) {
        return _totalSupply;
    }

    /**
     * @dev get aToken balance of this contract
     * @return aToken balance of this contract
     */
    function aTokenBalance() public view returns (uint256) {
        return aToken.balanceOf(address(this));
    }

    /**
     * @dev get TrueCurrency balance of this contract
     * @return TrueCurrency balance of this contract
     */
    function trueCurrencyBalance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Return value of stake in yTrueCurrency
     */
    function getValueInStake(uint256 _amount) public view returns (uint256) {
        return _amount.mul(10**18).div(tokenValue());
    }

    /**
     * @dev deposits TrueCurrency into AAVE using transferFrom
     * @param from account to transferFrom TrueCurrency
     * @param amount amount in TrueCurrency to deposit to AAVE
     * @return yTrueCurrency minted from this deposit
     */
    function deposit(address from, uint256 amount) external override onlyOwner returns (uint256) {
        require(token.transferFrom(from, address(this), amount), "transfer from failed");
        require(token.approve(address(lendingPool.core()), amount), "approve failed");

        // calculate balance before, deposit, calculate balance after
        uint256 balanceBefore = aTokenBalance();
        lendingPool.deposit(address(token), amount, 0);
        uint256 balanceAfter = aTokenBalance();

        uint256 yTrueCurrencyAmount = getValueInStake(balanceAfter.sub(balanceBefore));

        // increase yTrueCurrency supply
        _totalSupply = _totalSupply.add(yTrueCurrencyAmount);

        // return value in yTrueCurrency created from this deposit
        return yTrueCurrencyAmount;
    }

    /**
     * @dev Helper to withdraw TrueCurrency from Aave
     * aToken redemption amount is equal to yTrueCurrency * tokenValue
     * @param _to address to transfer TrueCurrency to
     * @param _amount amount in yTrueCurrency to redeem
     */
    function _redeem(address _to, uint256 _amount) internal returns (uint256) {
        // calculate amount in TrueCurrency
        uint256 trueCurrencyAmount = _amount.mul(tokenValue()).div(10**18);
        if (aToken.balanceOf(address(this)) < trueCurrencyAmount) {
            trueCurrencyAmount = aToken.balanceOf(address(this));
        }
        // get balance before, redeem, get balance after
        uint256 balanceBefore = trueCurrencyBalance();
        aToken.redeem(trueCurrencyAmount);
        uint256 balanceAfter = trueCurrencyBalance();

        // calculate TrueCurrency withdrawn
        uint256 fundsWithdrawn = balanceAfter.sub(balanceBefore);

        // sub yTrueCurrency supply
        if (getValueInStake(fundsWithdrawn) > _totalSupply) {
            _totalSupply = 0;
        } else {
            _totalSupply = _totalSupply.sub(getValueInStake(fundsWithdrawn));
        }

        // transfer to recipient and return amount withdrawn
        require(token.transfer(_to, fundsWithdrawn), "transfer failed");

        return fundsWithdrawn;
    }

    /**
     * @dev Withdraw from Aave to _to account
     * @param to account withdraw TrueCurrency to
     * @param amount amount of yTrueCurrency to redeem
     * @return TrueCurrency amount returned from redeem
     */
    function redeem(address to, uint256 amount) external override onlyOwner returns (uint256) {
        return _redeem(to, amount);
    }

    /**
     * @dev Redeem all yTrueCurrency Withdraws all TrueCurrency from AAVE
     * @param to account withdraw TrueCurrency to
     * @return TrueCurrency amount returned from redeem
     */
    function redeemAll(address to) external onlyOwner returns (uint256) {
        return _redeem(to, totalSupply());
    }

    // solhint-disable-next-line no-empty-blocks
    receive() external payable {}
}
