// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {ERC20, IERC20} from "./ERC20.sol";

abstract contract ReclaimerToken is ERC20 {
    /**
     * @dev send all eth balance in the contract to another address
     */
    function reclaimEther(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**
    * @dev send all token balance of an arbitrary erc20 token
    in the contract to another address
    */
    function reclaimToken(IERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }
}
