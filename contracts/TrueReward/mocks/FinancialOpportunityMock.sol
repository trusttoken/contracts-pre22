pragma solidity ^0.5.13;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract FinancialOpportunityMock {    
    using SafeMath for uint256;

    function deposit(address _from, uint _amount) external returns(uint) {
        return _amount.mul(101).div(103);
    }

    function withdrawTo(address _to, uint _amount) external returns(uint) {
        return _amount.mul(10**18).div(perTokenValue());
    }

    function perTokenValue() public returns(uint) {
        return 1004165248827609279;
    }
}
