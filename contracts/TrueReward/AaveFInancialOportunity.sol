pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueRewardBackedToken.sol";
import "./IAToken.sol";
import "./ILendingPool.sol";
import "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import "../TrueCurrencies/IFinancialOpportunity.sol";
import "./IdGenerator.sol";

contract IEarnFinancialOpportunity is IFinancialOpportunity {
    using SafeMath for uint256;

    IAToken public sharesToken;
    ILendingPool public lendingPool;
    TrueRewardBackedToken public token;
    mapping (address => uint256) public shares;
    mapping (address => uint256) public lastIndex;

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

    function cumulateIntereset(address _account) internal {
        ILendingPoolCore core = ILendingPoolCore(lendingPool.core());
        uint256 incomeIndex = core.getReserveNormalizedIncome();

        shares[_account] = shares[_account] * incomeIndex / lastIndex[_account]; // TODO use same math lib as AAVE
        lastIndex[_account] = incomeIndex;
    }

    function deposit(address _account, uint256 _amount) external returns(uint256) {
        cumulateIntereset(_account);

        require(token.transferFrom(_account, address(this), _amount), "transfer from failed");
        require(token.approve(address(yToken), _amount), "approve failed");
        
        uint256 balanceBefore = sharesToken.balanceOf(address(this));
        yToken.deposit(_amount);
        uint256 balanceAfter = sharesToken.balanceOf(address(this));
        uint256 sharesMinted = balanceAfter.sub(balanceBefore);
        require(sharesMinted >= 0);

        yTokenBalance[_account] = yTokenBalance[_account].add(sharesMinted);
        return sharesMinted;
    }

    function balanceOf(address _account) public view returns(uint256) {
        ILendingPoolCore core = ILendingPoolCore(lendingPool.core());
        uint256 incomeIndex = core.getReserveNormalizedIncome();

        return shares[_account] * incomeIndex / lastIndex[_account]; // TODO use same math lib as AAVE
    }

    function _withdraw(address _from, address _to, uint256 _amount) internal returns(uint256) {
        require(yTokenBalance[_from] >= _shares, "not enough balance");

        uint256 balanceBefore = token.balanceOf(address(this));
        yToken.withdraw(_amount);
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 fundsWithdrawn = balanceAfter.sub(balanceBefore);

        yTokenBalance[_from] = yTokenBalance[_from].sub(_amount);
        require(token.transfer(_to, fundsWithdrawn), "transfer failed");
        return _amount;
    }

    function withdrawTo(address _from, address _to, uint256 _amount) external returns(uint256) {
        cumulateIntereset(_account);
        return _withdrawShares(_from, _to, _amount);
    }

    function withdrawAll(address _account) external returns(uint256) {
        cumulateIntereset(_account);
        return _withdrawShares(_account, _account, yTokenBalance[_account]);
    }

    function perTokenValue() public view returns(uint) {
        return yToken.getPricePerFullShare();
    }

    function() external payable {
    }
}
