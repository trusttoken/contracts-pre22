pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueRewardBackedToken.sol";
import "./IAToken.sol";
import "./ILendingPool.sol";
import "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import "../TrueCurrencies/IFinancialOpportunity.sol";
import "./ILendingPoolCore.sol";
import "./IdGenerator.sol";

contract AaveFinancialOpportunity is IFinancialOpportunity {
    using SafeMath for uint256;

    IAToken public sharesToken;
    ILendingPool public lendingPool;
    TrueRewardBackedToken public token;
    mapping (address => uint256) public shares;

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
        return core.getReserveNormalizedIncome(address(token)) / 10**(27-18);
    }

    function getValueInShares(uint256 _amount) public view returns(uint256) {
        return _amount.mul(10**18).div(perTokenValue());
    }

    function getSharesValue(uint256 _shares) public view returns(uint256) {
        return _shares.mul(perTokenValue()).div(10**18);
    }

    function balanceOf(address _account) public view returns(uint256) {
        return shares[_account];
    }

    function deposit(address _account, uint256 _amount) external returns(uint256) {
        require(token.transferFrom(_account, address(this), _amount), "transfer from failed");
        require(token.approve(address(lendingPool), _amount), "approve failed");
        
        uint256 balanceBefore = sharesToken.balanceOf(address(this));
        lendingPool.deposit(address(token), _amount, 0);
        uint256 balanceAfter = sharesToken.balanceOf(address(this));
        uint256 sharesMinted = getValueInShares(balanceAfter.sub(balanceBefore));
        require(sharesMinted >= 0);

        shares[_account] = shares[_account].add(sharesMinted);
        return sharesMinted;
    }

    function _withdraw(address _from, address _to, uint256 _shares) internal returns(uint256) {
        require(shares[_from] >= _shares, "not enough balance");
        
        uint256 amount = getSharesValue(_shares);

        uint256 balanceBefore = token.balanceOf(address(this));
        sharesToken.redeem(amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 fundsWithdrawn = balanceAfter.sub(balanceBefore);
        uint256 sharesWithdrawn = getValueInShares(fundsWithdrawn);

        shares[_from] = shares[_from].sub(sharesWithdrawn);
        require(token.transfer(_to, fundsWithdrawn), "transfer failed");
        return sharesWithdrawn;
    }

    function withdrawTo(address _from, address _to, uint256 _amount) external returns(uint256) {
        return _withdraw(_from, _to, getValueInShares(_amount));
    }

    function withdrawAll(address _account) external returns(uint256) {
        return _withdraw(_account, _account, shares[_account]);
    }

    function() external payable {
    }
}
