pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueRewardBackedToken.sol";
import "./yTrueUSDInterface.sol";
import "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import "./IdGenerator.sol";

contract IEarnFinancialOpportunity {
    yTrueUSDInterface public yToken;
    TrueRewardBackedToken public token;
    mapping (address => uint256) public yTokenBalance;

    modifier onlyOwner() {
        require(msg.sender == proxyOwner(), "only owner");
        _;
    }

    modifier onlyToken() {
        require(msg.sender == address(token), "only token");
        _;
    }

    function configure(
        yTrueUSDInterface _yToken,
        TrueRewardBackedToken _token
    ) public onlyOwner {
        yToken = _yToken;
        token = _token;
    }

    function proxyOwner() public view returns(address) {
        return OwnedUpgradeabilityProxy(address(this)).proxyOwner();
    }

    function deposit(address _account, uint256 _amount) external /* onlyToken */ {
        if(_account == address(yToken)) {
            return;
        }
        require(token.approve(address(yToken), _amount), "approve failed");
        
        uint256 balanceBefore = yToken.balanceOf(address(this));
        yToken.deposit(_amount);
        uint256 balanceAfter = yToken.balanceOf(address(this));
        uint256 tokensMinted = balanceAfter - balanceBefore;
        require(tokensMinted >= 0);

        yTokenBalance[_account] += tokensMinted;
    }

    function balanceOf(address owner) public view returns(uint256) {
        return yTokenBalance[owner];
    }

    function _withdrawShares(address _from, address _to, uint256 _shares) internal returns(uint) {
        require(yTokenBalance[_from] >= _shares, "not enough balance");

        uint256 balanceBefore = token.balanceOf(address(this));
        yToken.withdraw(_shares);
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 fundsWithdrawn = balanceAfter - balanceBefore;

        yTokenBalance[_from] -= _shares;
        require(token.transfer(_to, fundsWithdrawn), "transfer failed");
        return _shares;
    }

    function withdrawTo(address _from, address _to, uint256 _amount) external returns(uint) {
        uint256 shares = _amount * 10**18 / perTokenValue();
        return _withdrawShares(_from, _to, shares);
    }

    function withdrawAll(address _account) external returns(uint) {
        return _withdrawShares(_account, _account, yTokenBalance[_account]);
    }

    function perTokenValue() public view returns(uint) {
        return yToken.getPricePerFullShare();
    }

    function() external payable {
    }
}
