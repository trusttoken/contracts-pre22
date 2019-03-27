pragma solidity ^0.4.23;

import "./ProxyStorage.sol";

contract Sheep39 {
    address owner;
    constructor() public {
        owner = msg.sender;
    }
    function() external payable {
        require(owner == msg.sender);
        //owner = 0;
        selfdestruct(0);
    }
}

/**  
@title Gas Refund Token
Allow any user to sponsor gas refunds for transfer and mints. Utilitzes the gas refund mechanism in EVM
Each time an non-empty storage slot is set to 0, evm refund 15,000 (19,000 after Constantinople) to the sender
of the transaction. 
*/
contract GasRefundToken is ProxyStorage {

    function sponsorGas2() external {
        Sheep39 sheep1;
        Sheep39 sheep2;
        Sheep39 sheep3;
        bytes20 me = bytes20(address(this));
        /** Sheep (31 bytes = 3 + 20 + 8)
          00 RETURNDATASIZE 3d                                            0
          01 CALLER         33                                            0 caller
          02 PUSH20(me)     73memememememememememememememememememememe    0 caller me
          17 EQ             14                                            0 valid
          18 PUSH1(1d)      601d                                          0 valid 1d
          1a JUMPI          57                                            0
          1b DUP1           80                                            0 0
          1c REVERT         fd
          1d JUMPDEST       5b                                            0
          1e SELFDESTRUCT   ff
        */
        /* Deploy (9 bytes)
          00 PUSH1(31)      60 1f                                         1f
          02 DUP1           80                                            1f 1f
          03 PUSH1(9)       60 09                                         1f 1f 09
          05 RETURNDATASIZE 3d                                            1f 1f 09 00
          06 CODECOPY       39                                            1f
          07 RETURNDATASIZE 3d                                            1f 00
          08 RETURN         f3
        */
        assembly {
            let data := mload(0x40)
            mstore(data,            0x601f8060093d393df33d33730000000000000000000000000000000000000000)
            mstore(add(data, 12), me)
            mstore(add(data, 32), 0x14601d5780fd5bff000000000000000000000000000000000000000000000000)
            sheep1 := create(0, data, 0x28)
            sheep2 := create(0, data, 0x28)
            sheep3 := create(0, data, 0x28)
            let offset := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
            let location := sub(0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe,offset)
            sstore(location, sheep1)
            sstore(sub(location, 1), sheep2)
            sstore(sub(location, 2), sheep2)
            sstore(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, add(offset, 3))
        }
    }

    /**
    @dev refund 39,000 gas
    @dev costs slightly more than 16,100 gas
    */
    function gasRefund39() internal {
        assembly {
            let offset := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
            if gt(offset, 0) {
              let location := sub(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,offset)
              sstore(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, sub(offset, 1))
              let sheep := sload(location)
              pop(call(gas, sheep, 0, 0, 0, 0, 0))
              sstore(location, 0)
            }
        }
    }

    function sponsorGas() external {
        uint256 refundPrice = minimumGasPriceForFutureRefunds;
        require(refundPrice > 0);
        assembly {
            let offset := sload(0xfffff)
            let result := add(offset, 9)
            sstore(0xfffff, result)
            let position := add(offset, 0x100000)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
        }
    }

    function minimumGasPriceForRefund() public view returns (uint256 result) {
        assembly {
            let offset := sload(0xfffff)
            let location := add(offset, 0xfffff)
            result := add(sload(location), 1)
        }
    }

    /**  
    @dev refund 45,000 gas for functions with gasRefund modifier.
    @dev costs slightly more than 20,400 gas
    */
    function gasRefund45() internal {
        assembly {
            let offset := sload(0xfffff)
            if gt(offset, 2) {
                let location := add(offset, 0xfffff)
                if gt(gasprice,sload(location)) {
                    sstore(location, 0)
                    location := sub(location, 1)
                    sstore(location, 0)
                    location := sub(location, 1)
                    sstore(location, 0)
                    sstore(0xfffff, sub(offset, 3))
                }
            }
        }
    }

    /**  
    @dev refund 30,000 gas for functions with gasRefund modifier.
    @dev costs slightly more than 15,400 gas
    */
    function gasRefund30() internal {
        assembly {
            let offset := sload(0xfffff)
            if gt(offset, 1) {
                let location := add(offset, 0xfffff)
                if gt(gasprice,sload(location)) {
                    sstore(location, 0)
                    location := sub(location, 1)
                    sstore(location, 0)
                    sstore(0xfffff, sub(offset, 2))
                }
            }
        }
    }

    /**  
    @dev refund 15,000 gas for functions with gasRefund modifier.
    @dev costs slightly more than 10,200 gas
    */
    function gasRefund15() internal {
        assembly {
            let offset := sload(0xfffff)
            if gt(offset, 1) {
                let location := add(offset, 0xfffff)
                if gt(gasprice,sload(location)) {
                    sstore(location, 0)
                    sstore(0xfffff, sub(offset, 1))
                }
            }
        }
    }

    /**  
    *@dev Return the remaining sponsored gas slots
    */
    function remainingGasRefundPool() public view returns (uint length) {
        assembly {
            length := sload(0xfffff)
        }
    }

    function gasRefundPool(uint256 _index) public view returns (uint256 gasPrice) {
        assembly {
            gasPrice := sload(add(0x100000, _index))
        }
    }

    bytes32 constant CAN_SET_FUTURE_REFUND_MIN_GAS_PRICE = "canSetFutureRefundMinGasPrice";

    function setMinimumGasPriceForFutureRefunds(uint256 _minimumGasPriceForFutureRefunds) public {
        require(registry.hasAttribute(msg.sender, CAN_SET_FUTURE_REFUND_MIN_GAS_PRICE));
        minimumGasPriceForFutureRefunds = _minimumGasPriceForFutureRefunds;
    }
}
