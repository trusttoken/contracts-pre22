// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrencyWithLegacyAutosweep} from "../TrueCurrencyWithLegacyAutosweep.sol";

contract MockTrueCurrencyWithAutosweep is TrueCurrencyWithLegacyAutosweep {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    address delegateFrom;

    function initialize() external {
        require(!initialized);
        owner = msg.sender;
        initialized = true;
    }

    // set delegate address for forwarding ERC20 calls
    function setDelegateAddress(address _delegateFrom) external {
        delegateFrom = _delegateFrom;
    }

    // require msg.sender is the delegate smart contract
    modifier onlyDelegateFrom() virtual override {
        require(msg.sender == delegateFrom);
        _;
    }

    function decimals() public override pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public override pure returns (string memory) {
        return "TrueCurrency";
    }

    function symbol() public override pure returns (string memory) {
        return "TCUR";
    }
}
