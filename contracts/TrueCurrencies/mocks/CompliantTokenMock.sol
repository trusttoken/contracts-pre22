// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../CompliantDepositTokenWithHook.sol";

contract CompliantTokenMock is CompliantDepositTokenWithHook {
    constructor(address initialAccount, uint256 initialBalance) public {
        _setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
        burnMin = 0;
        burnMax = 1000000000 * 10**18;
    }

    function canBurn() internal override pure returns (bytes32) {
        return "canBurn";
    }
}
