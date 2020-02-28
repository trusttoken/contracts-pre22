pragma solidity ^0.5.13;

contract FinancialOpportunityInterfaceMock {
    /**
    * @dev deposits TUSD into interface first then transfer 
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    
    function deposit(address _account, uint _amount) external returns(uint) {
        
    }
    function withdraw(address _account, uint _amount) external returns(uint) {

    }
    function withdrawAll(address _account) external returns(uint) {

    }
    function perTokenValue() external returns(uint) {
        return 1004165248827609279;
    }
}