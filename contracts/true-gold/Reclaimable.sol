// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./common/Ownable.sol";
import "./common/ProxyStorage.sol";
import "./interface/IOwnable.sol";

contract Reclaimable is Ownable {
    function reclaimEther(address payable to) public onlyOwner {
        to.transfer(address(this).balance);
    }

    function reclaimToken(IERC20 token, address to) public onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(to, balance);
    }

    function reclaimContract(IOwnable ownable) public onlyOwner {
        ownable.transferOwnership(_owner);
    }
}
