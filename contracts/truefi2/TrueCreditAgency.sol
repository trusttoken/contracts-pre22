// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20, IERC20} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

contract TrueCreditAgency is UpgradeableClaimable {
    using SafeERC20 for ERC20;

    mapping(ITrueFiPool2 => bool) public isPoolAllowed;

    event PoolAllowanceChanged(ITrueFiPool2 pool, bool isAllowed);

    function initialize() public initializer {
        UpgradeableClaimable.initialize(msg.sender);
    }

    function setPoolAllowance(ITrueFiPool2 pool, bool isAllowed) external onlyOwner {
        isPoolAllowed[pool] = isAllowed;
        emit PoolAllowanceChanged(pool, isAllowed);
    }

    function borrow(ITrueFiPool2 pool, uint256 amount) external {
        require(isPoolAllowed[pool], "TrueCreditAgency: The pool is not whitelisted for borrowing");
        pool.borrow(amount);
        pool.token().safeTransfer(msg.sender, amount);
    }

    function repay(ITrueFiPool2 pool, uint256 amount) external {
        pool.token().safeTransferFrom(msg.sender, address(this), amount);
        pool.token().safeApprove(address(pool), amount);
        pool.repay(amount);
    }
}
