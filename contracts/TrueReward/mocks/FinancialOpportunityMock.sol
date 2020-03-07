pragma solidity ^0.5.13;

import "../FinancialOpportunity.sol";

contract FinancialOpportunityMock {
    function deposit(uint _amount) external returns(uint) {
        return _amount * 101 / 103;
    }
    function withdrawTo(address _from, address _account, uint _amount) external returns(uint) {
        // liquidate
    }
    function withdrawAll(address _account) external returns(uint, uint) {

    }
    function perTokenValue() external view returns(uint) {
        return 1004165248827609279;
    }
}
