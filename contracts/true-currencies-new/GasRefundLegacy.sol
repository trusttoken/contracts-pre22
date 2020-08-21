// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "./ProxyStorage.sol";

/**
 * @title Gas Reclaim Legacy
 *
 * Note: this contract does not affect any of the token logic. It merely
 * exists so the TokenController (owner) can reclaim the sponsored gas
 *
 * Previously TrueCurrency has a feature called "gas boost" which allowed
 * us to sponsor gas by setting non-empty storage slots to 1.
 * We are depricating this feature, but there is a bunch of gas saved
 * from years of sponsoring gas. This contract is meant to allow the owner
 * to take advantage of this leftover gas. Once all the slots are used, 
 * this contract can be removed from TrueCurrency.
 *
 * Utilitzes the gas refund mechanism in EVM. Each time an non-empty
 * storage slot is set to 0, evm will refund 15,000 to the sender
 *
*/
contract GasRefundLegacy is ProxyStorage {

    /** @dev Refund 15,000 gas per slot.
     * @param amount number of slots to free
     */
    function refundGas(uint256 amount) internal {
        // refund gas
        assembly {
            // get number of free slots
            let offset := sload(0xfffff)
            // make sure there are enough slots
            if gt(offset, amount) {
                let end := sub(offset, amount)
                // loop until amount is reached
                // i = storage location
                for { let location := offset }
                gt(location, end)
                { location := sub(location, 1) } {
                    // set storage location to zero
                    // this refunds 15,000 gas
                    sstore(location, 0)
                }
                // store new number of free slots
                sstore(0xfffff, end)
            }
        }
    }

    /**
     * @dev Refund gas by self destructing smart contracts "sheep"
     * @param amount number of sheep to self destruct
     * A "sheep" is a smart contract meant to be self-destructed "popped" 
     * for a gas refund. Refunds approx. 39,000 per sheep popped.
     */
    function refundGas2(uint256 amount) internal {
        assembly {
            // get number of sheep that can be self-destructed
            // stored at 0xffff...ffff (the last storage slot)
            let offset := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
            // make sure there are enough slots
            if gt(offset, amount) {
                // get location of next sheep to pop.
                // slots lower than 0xffff...ffff are sheep slots
                let end := sub(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, offset)
                // loop from location to end
                for { let location := offset } 
                lt(location, end) 
                { location := add(location, 1) } { 
                    // get sheep, self destruct (call sheep), and set location to 0
                    let sheep := sload(location)
                    pop(call(gas(), sheep, 0, 0, 0, 0, 0))
                    sstore(location, 0)
                }
                // store new number of sheep
                sstore(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, sub(offset, amount))
            }
        }
    }

    /**
     * @dev Return remaining "sheep" contracts for gas refunds
     * A number of sheep (contracts that self-destruct to refund gas)
     * were deployed by the legacy TrueCurrency contract. This function
     * gets the remaining sheep
     *
     * @return length number of remaining sheep contracts to self destruct
     */
    function remainingGasSheep() public view returns (uint256 length) {
        assembly {
            // get number of sheep available to self destruct
            // stored at 0xffff...ffff (the last storage slot)
            length := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
        }
    }

    /**
     * @dev Return  the remaining sponsored gas slots
     * @return length number of remaining storage slots for refunds
     */
    function remainingGasStorage() public view returns (uint256 length) {
        assembly {
            length := sload(0xfffff)
        }
    }
}
