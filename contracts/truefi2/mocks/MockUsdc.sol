// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUsdc is ERC20 {
    constructor() public ERC20("usdc", "usdc") {
        _setupDecimals(6);
    }

    function mint(address receiver, uint256 amount) external {
        _mint(receiver, amount);
    }
}
