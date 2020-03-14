pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueRewardBackedToken.sol";
import "./IAToken.sol";
import "./ILendingPool.sol";
import "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import "../TrueCurrencies/FinancialOpportunity.sol";
import "./ILendingPoolCore.sol";
import "./IdGenerator.sol";

contract AaveFinancialOpportunity is FinancialOpportunity {
    using SafeMath for uint256;

    IAToken public sharesToken;
    ILendingPool public lendingPool;
    TrueRewardBackedToken public token;

    modifier onlyOwner() {
        require(msg.sender == proxyOwner(), "only owner");
        _;
    }

    modifier onlyToken() {
        require(msg.sender == address(token), "only token");
        _;
    }

    function configure(
        IAToken _sharesToken,
        ILendingPool _lendingPool,
        TrueRewardBackedToken _token
    ) public onlyOwner {
        sharesToken = _sharesToken;
        lendingPool = _lendingPool;
        token = _token;
    }

    function proxyOwner() public view returns(address) {
        return OwnedUpgradeabilityProxy(address(this)).proxyOwner();
    }

    function perTokenValue() public view returns(uint256) {
        ILendingPoolCore core = ILendingPoolCore(lendingPool.core());
        return core.getReserveNormalizedIncome(address(token)).div(10**(27-18));
    }

    function getBalance() public view returns(uint256) {
        return sharesToken.balanceOf(address(this));
    }

    function getValueInShares(uint256 _amount) public view returns(uint256) {
        return _amount.mul(10**18).div(perTokenValue());
    }

    function deposit(address _from, uint256 _amount) external returns(uint256) {
        require(token.transferFrom(_from, address(this), _amount), "transfer from failed");
        require(token.approve(address(lendingPool), _amount), "approve failed");
        
        uint256 balanceBefore = getBalance();
        lendingPool.deposit(address(token), _amount, 0);
        uint256 balanceAfter = getBalance();

        return getValueInShares(balanceAfter.sub(balanceBefore));
    }

    function _withdraw(address _to, uint256 _amount) internal returns(uint256) {
        uint256 balanceBefore = token.balanceOf(address(this));
        sharesToken.redeem(_amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 fundsWithdrawn = balanceAfter.sub(balanceBefore);

        require(token.transfer(_to, fundsWithdrawn), "transfer failed");

        return getValueInShares(fundsWithdrawn);
    }

    function withdrawTo(address _to, uint256 _amount) external returns(uint256) {
        return _withdraw(_to, _amount);
    }

    function withdrawAll(address _to) external returns(uint256) {
        return _withdraw(_to, getBalance());
    }

    function() external payable {
    }
}
