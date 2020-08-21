// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {ERC20, IERC20} from "./ERC20.sol";

/**
 * @title ReclaimerToken
 * @dev ERC20 token which allows owner to reclaim ERC20 tokens
 * or ether sent to this contract. For contracts with legacy gas refund,
 * can reclaim gas.
 */
abstract contract ReclaimerToken is ERC20 {
    /**
     * @dev send all eth balance in the contract to another address
     * @param _to address to send eth balance to
     */
    function reclaimEther(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**
     * @dev send all token balance of an arbitrary erc20 token
     * in the contract to another address
     * @param token token to reclaim
     * @param _to address to send eth balance to
     */
    function reclaimToken(IERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }

    /**
     * @dev reclaim gas from legacy gas refund #1
     * will refund 15,000 * amount gas to sender (minus exection cost)
     */
    function reclaimGas(uint256 amount) external onlyOwner {
        refundGas(amount);
    }

    /**
     * @dev reclaim gas from legacy gas refund #2
     * will refund 39,000 * amount gas to sender (minus exection cost)
     */
    function reclaimGas2(uint256 amount) external onlyOwner {
        refundGas2(amount);
    }
}
