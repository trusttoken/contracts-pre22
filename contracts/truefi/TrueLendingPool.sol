// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITrueFiPool} from "./ITrueFiPool.sol";

contract TrueLendingPool is Ownable {
    using SafeMath for uint256;

    mapping(address => bool) public whitelisted;
    ITrueFiPool public immutable pool;

    event Whitelisted(address indexed who, bool status);

    constructor(ITrueFiPool _pool) public {
        pool = _pool;
        _pool.token().approve(address(_pool), uint256(-1));
    }

    function whitelistForLoan(address who, bool status) external onlyOwner {
        whitelisted[who] = status;
        emit Whitelisted(who, status);
    }
}
