// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "../../common/UpgradeableERC20.sol";
import {ITrueFiPool} from "./../interface/ITrueFiPool.sol";

contract MockStakingPool is ERC20 {
    ITrueFiPool pool;

    constructor(ITrueFiPool _pool) public {
        pool = _pool;
    }

    function stakeSupply() external pure returns (uint256) {
        return 0;
    }

    function withdraw(uint256) external pure {}

    function unstake() public {
        require(pool.transfer(msg.sender, pool.balanceOf(address(this))));
    }

    function payFee(uint256 amount, uint256) external {
        pool.transferFrom(msg.sender, address(this), amount);
    }
}
