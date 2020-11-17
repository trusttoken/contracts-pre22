// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * Mock ERC20 contract with public mint&burn functions
 */
contract MockERC20 is ERC20 {

    constructor (string memory name, string memory symbol) public ERC20(name, symbol) {
    }

    function mint(address _to, uint256 _value) external {
        _mint(_to, _value);
    }

    function burn(uint256 _value) external {
        _burn(msg.sender, _value);
    }
}
