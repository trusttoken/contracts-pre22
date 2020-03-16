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

contract FinancialOpportunityMock2 is FinancialOpportunity {

    function deposit(address _from, uint _amount) external returns(uint);
     /**
     * @dev Withdraw from finOp to _to account
     * @param _to account withdarw TUSD to
     * @param _amount amount in TUSD to withdraw from finOp
     * @return yTUSD amount deducted
     */
    function withdrawTo(address _to, uint _amount) external returns(uint);
    // withdrawll actually withdraw all tokens in finOp
    function withdrawAll(address _to) external returns(uint);
    function perTokenValue() external view returns(uint);

    function getBalance() external view returns(uint);
}