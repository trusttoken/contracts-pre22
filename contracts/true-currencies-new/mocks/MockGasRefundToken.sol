// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {MockTrueCurrency} from "./MockTrueCurrency.sol";

/** @title TrueCAD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract MockGasRefundToken is MockTrueCurrency {
    function sponsorGas(uint256 amount) external {
        uint256 refundPrice = uint256(-1);
        assembly {
            let offset := sload(0xfffff)
            let result := add(offset, amount)
            sstore(0xfffff, result)
            let position := add(offset, 0x100000)
            sstore(position, refundPrice)
            for {
                let i := 0
            } lt(i, sub(amount, 1)) {
                i := add(i, 1)
            } {
                position := add(position, 1)
                sstore(position, refundPrice)
            }
        }
    }
    //    function sponsorGas() external {
    //        uint256 refundPrice = 1;
    //        assembly {
    //            let offset := sload(0xfffff)
    //            let result := add(offset, 9)
    //            sstore(0xfffff, result)
    //            let position := add(offset, 0x100000)
    //            sstore(position, refundPrice)
    //            position := add(position, 1)
    //            sstore(position, refundPrice)
    //            position := add(position, 1)
    //            sstore(position, refundPrice)
    //            position := add(position, 1)
    //            sstore(position, refundPrice)
    //            position := add(position, 1)
    //            sstore(position, refundPrice)
    //            position := add(position, 1)
    //            sstore(position, refundPrice)
    //            position := add(position, 1)
    //            sstore(position, refundPrice)
    //            position := add(position, 1)
    //            sstore(position, refundPrice)
    //            position := add(position, 1)
    //            sstore(position, refundPrice)
    //        }
    //    }
}
