// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {MockTrueCurrencyWithDelegate} from "./MockTrueCurrencyWithDelegate.sol";

/**
 * @dev Contract that prevents addresses that were previously using autosweep addresses from
 * making transfers on them.
 *
 * In older versions TrueCurrencies had a feature called Autosweep.
 * Given a single deposit address, it was possible to generate 16^5-1 autosweep addresses.
 * E.g. having deposit address 0xc257274276a4e539741ca11b590b9447b26a8051, you could generate
 * - 0xc257274276a4e539741ca11b590b9447b2600000
 * - 0xc257274276a4e539741ca11b590b9447b2600001
 * - ...
 * - 0xc257274276a4e539741ca11b590b9447b26fffff
 * Every transfer to an autosweep address resulted as a transfer to deposit address.
 * This feature got deprecated, but there were 4 addresses that still actively using the feature.
 *
 * This contract will reject a transfer to these 4*(16^5-1) addresses to prevent accidental token freeze.
 */
abstract contract MockTrueCurrencyWithLegacyAutosweep is MockTrueCurrencyWithDelegate {
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        requireNotAutosweepAddress(recipient, 0x33091DE8341533468D13A80C5A670f4f47cC649f);
        requireNotAutosweepAddress(recipient, 0x50E2719208914764087e68C32bC5AaC321f5B04d);
        requireNotAutosweepAddress(recipient, 0x71d69e5481A9B7Be515E20B38a3f62Dab7170D78);
        requireNotAutosweepAddress(recipient, 0x90fdaA85D52dB6065D466B86f16bF840D514a488);

        super._transfer(sender, recipient, amount);
    }

    function requireNotAutosweepAddress(address recipient, address depositAddress) internal pure {
        return
            require(uint256(recipient) >> 20 != uint256(depositAddress) >> 20 || recipient == depositAddress, "Autosweep is disabled");
    }
}
