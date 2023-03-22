// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IBEP20} from "../interface/IBEP20.sol";
import {ITrueCurrency} from "../interface/ITrueCurrency.sol";
import {BEP20} from "./BEP20.sol";

/**
 * @title ReclaimerToken
 * @dev ERC20 token which allows owner to reclaim ERC20 tokens
 * or ether sent to this contract
 */
abstract contract ReclaimerToken is BEP20, ITrueCurrency {
    /**
     * @dev send all eth balance in the contract to another address
     * @param _to address to send eth balance to
     */
    function reclaimEther(address payable _to) external override onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**
     * @dev send all token balance of an arbitrary erc20 token
     * in the contract to another address
     * @param token token to reclaim
     * @param _to address to send eth balance to
     */
    function reclaimToken(IBEP20 token, address _to) external override onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }
}
