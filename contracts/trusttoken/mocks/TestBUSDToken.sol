// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "../common/ERC20.sol";

contract TestBUSDToken is ERC20 {
    uint8 constant DECIMALS = 18;

    function mint(address _to, uint256 _value) public {
        _mint(_to, _value);
    }

    function burn(uint256 _value) public {
        _burn(msg.sender, _value);
    }

    function decimals() public override pure returns (uint8) {
        return DECIMALS;
    }

    function name() public override pure returns (string memory) {
        return "Binance USD";
    }

    function symbol() public override pure returns (string memory) {
        return "BUSD";
    }
}
