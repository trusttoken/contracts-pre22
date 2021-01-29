// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ERC20} from "./../common/UpgradeableERC20.sol";

// this contract will be deleted after real StakingPool is integrated
contract MockStakingPool is ERC20 {
    IERC20 trustToken;

    function setTrustToken(IERC20 _trustToken) public {
        trustToken = _trustToken;
    }

    function value() public returns(uint256) {
        // lets assume for test that they are worth half a dolar
        return trustToken.balanceOf(address(this)).div(2);
    }

    //only for lender
    function withdraw(uint256 amount) external {
        trustToken.transfer(msg.sender, amount);
    }
}
