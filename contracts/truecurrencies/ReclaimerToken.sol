// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {HasOwner} from "./HasOwner.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {InstantiatableOwnable} from "./modularERC20/InstantiatableOwnable.sol";

contract ReclaimerToken is HasOwner {
    /**
     *@dev send all eth balance in the contract to another address
     */
    function reclaimEther(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**
    *@dev send all token balance of an arbitrary erc20 token
    in the contract to another address
    */
    function reclaimToken(IERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }

    /**
     *@dev allows owner of the contract to gain ownership of any contract that the contract currently owns
     */
    function reclaimContract(InstantiatableOwnable _ownable) external onlyOwner {
        _ownable.transferOwnership(owner);
    }
}
