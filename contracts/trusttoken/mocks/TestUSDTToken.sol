// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "../common/ERC20.sol";

contract TestUSDTToken is ERC20 {
    uint8 constant DECIMALS = 6;

    function mint(address _to, uint256 _value) public {
        _mint(_to, _value);
    }

    function burn(uint256 _value) public {
        _burn(msg.sender, _value);
    }

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    function name() public pure override returns (string memory) {
        return "USD Tether";
    }

    function symbol() public pure override returns (string memory) {
        return "USDT";
    }
}
