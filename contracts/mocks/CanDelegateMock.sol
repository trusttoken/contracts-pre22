pragma solidity ^0.5.13;

import "./CanDelegateV1.sol";

contract CanDelegateMock is CanDelegateV1 {
    event Burn(address indexed burner, uint256 value);
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheetV1();
        allowances = new AllowanceSheetV1();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
    }
    
    function reclaimContract(OwnableV1 _ownable) external onlyOwner {
        _ownable.transferOwnership(owner);
    }
}
