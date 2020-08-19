// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockYearn {
    IERC20 public token;
    uint sharePrice = 1e18;

    constructor(IERC20 _token) {
        token = _token;
    }

    function deposit(uint256 _amount) external {
        token.transferFrom(msg.sender, address(this), _amount);
    }

    function withdraw(uint256 _shares) external {
        token.transfer(msg.sender, _shares * sharePrice / 1e18);
    }

    function getPricePerFullShare() external view returns (uint256) {
        return sharePrice;
    }

    function getPricePerFullShare(uint price) external {
        sharePrice = price;
    }
}
