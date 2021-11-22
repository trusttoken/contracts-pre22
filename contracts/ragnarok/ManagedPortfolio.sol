pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts4/token/ERC20/IERC20.sol";

contract ManagedPortfolio {
    IERC20 underlyingToken;

    constructor(IERC20 _underlyingToken) {
        underlyingToken = _underlyingToken;
    }

    function join(uint256 amount) external {
        underlyingToken.transferFrom(msg.sender, address(this), amount);
    }
}
