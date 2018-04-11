pragma solidity ^0.4.18;

import "../TrueUSD.sol";

contract TrueUSDMock is TrueUSD {

    function TrueUSDMock(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }

}
