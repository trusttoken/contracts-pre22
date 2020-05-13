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
 * @dev Financial Opportunity to earn TrueUSD with Aave.
 * aToken = aTUSD on Aave
 * We assume tokenValue always increases
 */
contract AaveFinancialOpportunity is FinancialOpportunity, InstantiatableOwnable {
    using SafeMath for uint256;

    /** aTUSD token contract from AAVE */
    IAToken public aToken;

    /** LendingPool contract from AAVE */
    ILendingPool public lendingPool;

    /** TrueUSD */
    TrueUSD public token;

    modifier onlyProxyOwner() {
        require(msg.sender == proxyOwner(), "only proxy owner");
        _;
    }

    /**
     * @dev Set up Aave Opportunity
     */
    function configure(
        IAToken _aToken,        // aToken
        ILendingPool _lendingPool,  // lendingPool interface
        TrueUSD _token,             // TrueUSD
        address _owner              // owner
    ) public onlyProxyOwner {
        require(address(_aToken) != address(0), "aToken cannot be address(0)");
        require(address(_lendingPool) != address(0), "lendingPool  cannot be address(0)");
        require(address(_token) != address(0), "TrueUSD cannot be address(0)");
        require(_owner != address(0), "Owner cannot be address(0)");
        aToken = _aToken;
        lendingPool = _lendingPool;
        token = _token;
        owner = _owner;
    }

    function proxyOwner() public view returns(address) {
        return OwnedUpgradeabilityProxy(address(this)).proxyOwner();
    }

    /**
     * Exchange rate between TUSD and zTUSD
     * @return TUSD / zTUSD price ratio (18 decimals of percision)
     */
    function tokenValue() public view returns(uint256) {
        ILendingPoolCore core = ILendingPoolCore(lendingPool.core());
        return core.getReserveNormalizedIncome(address(token)).div(10**(27-18));
    }

    /**
     * Returns full balance of opportunity
     * @return TUSD balance of opportunity
    **/
    function totalSupply() public view returns(uint256) {
        return aToken.balanceOf(address(this));
    }

    /** @dev Return value of stake in yTUSD */
    function getValueInStake(uint256 _amount) public view returns(uint256) {
        return _amount.mul(10**18).div(tokenValue());
    }

    /**
    * @dev deposits TrueUSD into AAVE using transferFrom
    * @param _from account to transferFrom
    * @param _amount amount in TUSD to deposit to AAVE
    * @return yTUSD minted from this deposit
    */
    function deposit(address _from, uint256 _amount) external onlyOwner returns(uint256) {
        require(token.transferFrom(_from, address(this), _amount), "transfer from failed");
        require(token.approve(address(lendingPool), _amount), "approve failed");

        uint256 balanceBefore = totalSupply();
        lendingPool.deposit(address(token), _amount, 0);
        uint256 balanceAfter = totalSupply();

        return getValueInStake(balanceAfter.sub(balanceBefore));
    }

    /** @dev Helper to withdraw TUSD from Aave */
    function _redeem(address _to, uint256 ytusd) internal returns(uint256) {
        uint tusd = ytusd.mul(tokenValue()).div(10**18);
        uint256 balanceBefore = token.balanceOf(address(this));
        aToken.redeem(tusd);
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 fundsWithdrawn = balanceAfter.sub(balanceBefore);

        require(token.transfer(_to, fundsWithdrawn), "transfer failed");

        return fundsWithdrawn;
    }

    /**
     * @dev Withdraw from Aave to _to account
     * @param _to account withdarw TUSD to
     * @param _amount amount in TUSD to withdraw from AAVE
     * @return TUSD amount redeemed
     */
    function redeem(address _to, uint256 _amount) external onlyOwner returns(uint256) {
        return _redeem(_to, _amount);
    }

    /**
     * @dev Withdraws all TUSD from AAVE
     * @param _to account withdarw TUSD to
     * @return zTUSD amount deducted
     */
    function redeemAll(address _to) external onlyOwner returns(uint256) {
        return _redeem(_to, totalSupply());
    }

    function() external payable {
    }
}
