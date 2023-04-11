// SPDX-License-Identifier: MIT
pragma solidity 0.6.0;

import {TRC20} from "./TRC20.sol";
import {ITRC20} from "../interface/ITRC20.sol";

/**
 * @title ReclaimerToken
 * @dev TRC20 token which allows owner to reclaim TRC20 tokens
 * or trx sent to this contract
 */
abstract contract ReclaimerToken is TRC20 {
    /**
     * @dev send all trx balance in the contract to another address
     * @param _to address to send trx balance to
     */
    function reclaimTrx(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**
     * @dev send all token balance of an arbitrary trc20 token
     * in the contract to another address
     * @param token token to reclaim
     * @param _to address to send trc20 balance to
     */
    function reclaimToken(ITRC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }
}