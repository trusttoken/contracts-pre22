pragma solidity ^0.4.23;

import "../deployed/CanDelegateV1.sol";

contract CanDelegateMock is CanDelegateV1 {
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheetV1();
        allowances = new AllowanceSheetV1();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
}
