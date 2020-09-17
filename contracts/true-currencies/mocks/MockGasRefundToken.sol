// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {MockTrueCurrencyWithGasRefund} from "./MockTrueCurrencyWithGasRefund.sol";

contract MockGasRefundToken is MockTrueCurrencyWithGasRefund {
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

    function sponsorGas2(uint256 amount) external {
        /**
        Deploy (9 bytes)
          PC Assembly       Opcodes                                       Stack
          00 PUSH1(27)      60 1b                                         1b
          02 DUP1           80                                            1b 1b
          03 PUSH1(9)       60 09                                         1b 1b 09
          05 RETURNDATASIZE 3d                                            1b 1b 09 00
          06 CODECOPY       39                                            1b
          07 RETURNDATASIZE 3d                                            1b 00
          08 RETURN         f3
        Sheep (27 bytes = 3 + 20 + 4)
          PC Assembly       Opcodes                                       Stack
          00 RETURNDATASIZE 3d                                            00
          01 CALLER         33                                            00 caller
          02 PUSH20(me)     73 memememememememememememememememememememe   00 caller me
          17 XOR            18                                            00 invalid
          18 PC             58                                            00 invalid 18
          19 JUMPI          57                                            00
          1a SELFDESTRUCT   ff
        */
        assembly {
            mstore(0, or(0x601b8060093d393df33d33730000000000000000000000000000000000000000, address()))
            mstore(32, 0x185857ff00000000000000000000000000000000000000000000000000000000)
            let offset := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
            let location := sub(0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe, offset)
            for {
                let i := 0
            } lt(i, amount) {
                i := add(i, 1)
            } {
                sstore(location, create(0, 0, 0x24))
                location := sub(location, 1)
            }
            sstore(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, add(offset, amount))
        }
    }
}
