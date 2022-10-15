// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

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
 * storage slot is set to 0, evm will refund 15,000 to the sender.
 * Also utilized the refund for selfdestruct, see gasRefund39
 */
abstract contract GasRefund {
    /**
     * @dev Refund 15,000 gas per slot.
     * @param amount number of slots to free
     */
    function gasRefund15(uint256 amount) internal {
        assembly {
            // get number of free slots
            let offset := sload(0xfffff)
            // make sure there are enough slots
            if lt(offset, amount) {
                amount := offset
            }
            if eq(amount, 0) {
                stop()
            }
            // get location of first slot
            let location := add(offset, 0xfffff)
            // loop until end is reached
            for {
                let end := sub(location, amount)
            } gt(location, end) {
                location := sub(location, 1)
            } {
                // set storage location to zero
                // this refunds 15,000 gas
                sstore(location, 0)
            }
            // store new number of free slots
            sstore(0xfffff, sub(offset, amount))
        }
    }

    /**
     * @dev use smart contract self-destruct to refund gas
     * will refund 39,000 * amount gas
     */
    function gasRefund39(uint256 amount) internal {
        assembly {
            // get amount of gas slots
            let offset := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
            // make sure there are enough slots
            if lt(offset, amount) {
                amount := offset
            }
            if eq(amount, 0) {
                stop()
            }
            // first sheep pointer
            let location := sub(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, offset)
            // loop from location to end
            for {
                let end := add(location, amount)
            } lt(location, end) {
                location := add(location, 1)
            } {
                // load sheep address
                let sheep := sload(location)
                // call selfdestruct on sheep
                pop(call(gas(), sheep, 0, 0, 0, 0, 0))
                // clear sheep address
                sstore(location, 0)
            }
            // store new number of sheep
            sstore(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, sub(offset, amount))
        }
    }

    /**
     * @dev Return the remaining sponsored gas slots
     */
    function remainingGasRefundPool() public view returns (uint256 length) {
        assembly {
            length := sload(0xfffff)
        }
    }

    /**
     * @dev Return the remaining sheep slots
     */
    function remainingSheepRefundPool() public view returns (uint256 length) {
        assembly {
            length := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
        }
    }
}
