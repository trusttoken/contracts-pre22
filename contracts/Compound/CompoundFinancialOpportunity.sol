pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueRewardBackedToken.sol";
import "./CErc20Interface.sol";

contract CompoundFinancialOpportunity is TrueCoinReceiver {
    CErc20Interface public cToken;
    TrueRewardBackedToken public token;
    mapping (address => uint256) public cTokenBalance;

    constructor(
        CErc20Interface _cToken,
        TrueRewardBackedToken _token
    ) public {
        cToken = _cToken;
        token = _token;
    }

    function cTokenAddress() public view returns(address) {
        return address(cToken);
    }

    function tokenAddress() public view returns(address ) {
        return address(token);
    }

    function tokenFallback(address from, uint256 value) external {
        // require(msg.sender == address(token), "fallback must be called from token's address");
        require(token.approve(address(cToken), value), "approve failed");
        require(cToken.mint(value) == 0, "mint failed");
        cTokenBalance[from] += value;
    }

    function balanceOf(address owner) public view returns(uint256) {
        return cTokenBalance[owner];
    }
}
