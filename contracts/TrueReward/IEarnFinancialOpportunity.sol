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

    function deposit(address from, uint256 value) external /* onlyToken */ {
        if(from == address(yToken)) {
            return;
        }
        require(token.approve(address(yToken), value), "approve failed");
        
        uint256 balanceBefore = yToken.balanceOf(address(this));
        yToken.deposit(value);
        uint256 balanceAfter = yToken.balanceOf(address(this));
        uint256 tokensMinted = balanceAfter - balanceBefore;
        require(tokensMinted >= 0);

        yTokenBalance[from] += tokensMinted;
    }

    function balanceOf(address owner) public view returns(uint256) {
        return yTokenBalance[owner];
    }

    function withdraw(address owner, uint256 shares) external {
        require(yTokenBalance[owner] >= shares, "not enough balance");

        uint256 balanceBefore = token.balanceOf(address(this));
        yToken.withdraw(shares);
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 fundsWithdrawn = balanceAfter - balanceBefore;

        yTokenBalance[owner] -= shares;
        require(token.transfer(owner, fundsWithdrawn), "transfer failed");
    }

    function() external payable {
    }
}
