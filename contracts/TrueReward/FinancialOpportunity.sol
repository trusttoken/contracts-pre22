pragma solidity ^0.5.13;

/** Interface for Financial Opportunities. **/
interface FinancialOpportunity {
    function deposit(address _account, uint _amount) external returns(uint);
    function withdrawTo(address _from, address _to, uint _amount) external returns(uint);
    function withdrawAll(address _account) external returns(uint);
    function perTokenValue() external view returns(uint);
}