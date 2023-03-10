// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IBEP20} from "../interface/IBEP20.sol";
import {BEP20} from "./BEP20.sol";

/**
 * @title ReclaimerToken
 * @dev BEP20 token which allows owner to reclaim BEP20 tokens
 * or bnb sent to this contract
 */
abstract contract ReclaimerToken is BEP20 {
    /**
     * @dev send all bnb balance in the contract to another address
     * @param _to address to send bnb balance to
     */
    function reclaimBNB(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**
     * @dev send all token balance of an arbitrary BEP20 token
     * in the contract to another address
     * @param token token to reclaim
     * @param _to address to send BEP20 balance to
     */
    function reclaimToken(IBEP20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }
}
