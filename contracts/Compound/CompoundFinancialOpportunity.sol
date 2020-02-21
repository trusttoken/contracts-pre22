pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueRewardBackedToken.sol";
import "./CErc20Interface.sol";
import "../TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol";
import "./IdGenerator.sol";

contract CompoundFinancialOpportunity is TrueCoinReceiver, IdGenerator {
    CErc20Interface public cToken;
    TrueRewardBackedToken public token;
    IRewardManager public rewardManager;
    mapping (address => uint256) public cTokenBalance;

    struct FailedWithdrawal {
        uint256 id;
        uint256 timestamp;
        uint256 amount;
    }

    mapping (address => FailedWithdrawal) public failedWithdrawals;

    modifier onlyOwner() {
        require(msg.sender == proxyOwner(), "only owner");
        _;
    }

    modifier onlyRewardManager() {
        require(msg.sender == address(rewardManager), "only reward manager");
        _;
    }

    modifier onlyToken() {
        require(msg.sender == address(token), "only token");
        _;
    }

    function configure(
        CErc20Interface _cToken,
        TrueRewardBackedToken _token,
        IRewardManager _rewardManager
    ) public onlyOwner {
        cToken = _cToken;
        token = _token;
        rewardManager = _rewardManager;
    }

    function proxyOwner() public view returns(address) {
        return OwnedUpgradeabilityProxy(address(this)).proxyOwner();
    }

    function tokenFallback(address from, uint256 value) external /* onlyToken */ {
        require(token.approve(address(cToken), value), "approve failed");
        
        uint256 balanceBefore = cToken.balanceOf(address(this));
        require(cToken.mint(value) == 0, "mint failed");
        uint256 balanceAfter = cToken.balanceOf(address(this));
        uint256 tokensMinted = balanceAfter - balanceBefore;
        require(tokensMinted >= 0);

        cTokenBalance[from] += tokensMinted;
    }

    function balanceOf(address owner) public view returns(uint256) {
        return cTokenBalance[owner];
    }

    function withdraw(uint256 amount) external returns(uint256) {
        return _withdraw(msg.sender, amount);
    }

    function withdrawFor(address owner, uint256 amount) external onlyRewardManager returns(uint256) {
        return _withdraw(owner, amount);
    }

    function _withdraw(address owner, uint256 amount) internal returns(uint256) {
        require(cTokenBalance[owner] >= amount, "not enough balance");

        uint256 balanceBefore = token.balanceOf(address(this));
        if(cToken.redeem(amount) != 0) {
            failedWithdrawals[owner].id = getNextId();
            failedWithdrawals[owner].timestamp = block.timestamp;
            failedWithdrawals[owner].amount = amount;
            return 1;
        }
        uint256 balanceAfter = token.balanceOf(address(this));
        uint256 fundsWithdrawn = balanceAfter - balanceBefore;

        require(token.transfer(owner, fundsWithdrawn), "transfer failed");
        cTokenBalance[owner] -= amount;
    }

    function hasFailedWithdrawal(address owner) public view returns(bool) {
        return failedWithdrawals[owner].timestamp > 0;
    }

    function replayFailedWithdrawal(address owner) external onlyRewardManager {
        require(hasFailedWithdrawal(owner), "no failed withdrawals");

        require(_withdraw(owner, failedWithdrawals[owner].amount) == 0);

        failedWithdrawals[owner].id = 0;
        failedWithdrawals[owner].timestamp = 0;
        failedWithdrawals[owner].amount = 0;
    }

    function() external payable {
    }
}
