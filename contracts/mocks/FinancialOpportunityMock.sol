pragma solidity ^0.5.13;

import "../TrueReward/FinancialOpportunity.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract FinancialOpportunityMock is FinancialOpportunity {
  IERC20 token;
  uint balance;
  uint perTokenValueField = 1*10**18;

  constructor(IERC20 _token) public {
    token = _token;
  }

  function deposit(address _from, uint _amount) external returns(uint) {
    uint shares = _amount * 10**18 / perTokenValueField;
    require(token.transferFrom(_from, address(this), _amount), "FinOpMock/deposit/transferFrom");
    balance += shares;
    return shares;
  }

  function withdrawTo(address _to, uint _amount) external returns(uint) {
    uint shares = _amount * 10**18 / perTokenValueField;
    require(shares <= balance, "FinOpMock/withdrawTo/balanceCheck");
    require(token.transfer(_to, _amount), "FinOpMock/withdrawTo/trasfer");
    balance -= shares;
    return shares;
  }
  
  function withdrawAll(address _to) external returns(uint) {
    uint shares = balance;
    uint tokens = shares * perTokenValueField / 10**18;
    require(token.transfer(_to, tokens), "FinOpMock/withdrawAll/trasfer");
    balance = 0;
    return shares;
  }

  
  function perTokenValue() external view returns(uint) {
    return perTokenValueField;
  }

  
  function getBalance() external view returns(uint) {
    return balance;
  }

  function setPerTokenValue(uint _perTokenValue) external {
    perTokenValueField = _perTokenValue;
  }
}
