pragma solidity ^0.5.13;

import "../TrueCurrencies/TrueRewardBackedToken.sol";
import "./CErc20Interface.sol";

contract CompoundFinancialOpportunity {
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

    function tokenAddress() public view returns(address) {
        return address(token);
    }
}
