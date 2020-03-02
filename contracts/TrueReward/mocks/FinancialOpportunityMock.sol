pragma solidity ^0.5.13;

contract FinancialOpportunityMock {    
    function deposit(address _account, uint _amount) external returns(uint) {
        return _amount * 101 / 103;
    }
    function withdraw(address _from, address _account, uint _amount) external returns(uint) {

    }
    function withdrawAll(address _account) external returns(uint, uint) {

    }
    function perTokenValue() external returns(uint) {
        return 1004165248827609279;
    }
}
