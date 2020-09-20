// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrencyWithLegacyAutosweep} from "../TrueCurrencyWithLegacyAutosweep.sol";

/**
 * Transfer funds from IDEX smart contract to recovery account
 *
 * This contract was created in collaboration with IDEX to help recover
 * stuck funds after TUSD removed support for the legacy smart contract.
 *
 */
abstract contract IDEXRecover is TrueCurrencyWithLegacyAutosweep {
    address constant IDEX_CONTRACT = 0x2a0c0DBEcC7E4D658f48E01e3fA353F44050c208;
    // temp address, not correct!!
    address constant RECOVERY_ADDRESS = 0xf6E2Da7D82ee49f76CE652bc0BeB546Cbe0Ea521;
    uint256 constant RECOVERY_AMOUNT = 128386000000000000000000;
    
    /*
     * @dev burn funds at IDEX address and issue new TUSD
     */
    function recover() external onlyOwner {
        // transfer funds to new address
        _transfer(IDEX_CONTRACT, RECOVERY_ADDRESS, RECOVERY_AMOUNT);
    }
}