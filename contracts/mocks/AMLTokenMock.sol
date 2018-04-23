pragma solidity ^0.4.21;

import "../AMLToken.sol";

contract AMLTokenMock is AMLToken {
    function AMLTokenMock(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
