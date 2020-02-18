pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueRewardBackedToken.sol";
import "./CErc20Interface.sol";

contract CompoundFinancialOpportunity is TrueCoinReceiver, Ownable {
    CErc20Interface public cToken;
    TrueRewardBackedToken public token;
    IRewardManager public rewardManager;
    mapping (address => uint256) public cTokenBalance;

    constructor(
        CErc20Interface _cToken,
        TrueRewardBackedToken _token,
        IRewardManager _rewardManager
    ) public {
        configure(_cToken, _token, _rewardManager);
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

    function cTokenAddress() public view returns(address) {
        return address(cToken);
    }

    function tokenAddress() public view returns(address) {
        return address(token);
    }

    function tokenFallback(address from, uint256 value) external /* onlyToken */ {
        require(token.approve(address(cToken), value), "approve failed");
        require(cToken.mint(value) == 0, "mint failed");
        cTokenBalance[from] += value;
    }

    function balanceOf(address owner) public view returns(uint256) {
        return cTokenBalance[owner];
    }

    function withdraw(uint256 amount) external {
        _withdraw(msg.sender, amount);
    }

    function withdrawManager(address owner, uint256 amount) external onlyRewardManager {
        _withdraw(owner, amount);
    }

    function _withdraw(address owner, uint256 amount) internal {
        require(cTokenBalance[owner] >= amount, "not enough balance");
        require(cToken.redeem(amount) == 0, "redeem failed");
        require(token.transfer(owner, amount), "transfer failed");
        cTokenBalance[owner] -= amount;
    }
}
