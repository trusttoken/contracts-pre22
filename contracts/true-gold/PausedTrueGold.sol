// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "./TrueGold.sol";

contract PausedTrueGold is TrueGold {
    function transfer(
        address, /*recipient*/
        uint256 /*amount*/
    ) public override returns (bool) {
        revert("Token Paused");
    }

    function transferFrom(
        address, /*sender*/
        address, /*recipient*/
        uint256 /*amount*/
    ) public override returns (bool) {
        revert("Token Paused");
    }

    function burn(
        uint256 /*amount*/
    ) public override {
        revert("Token Paused");
    }

    function burnFrom(
        address, /*account*/
        uint256 /*amount*/
    ) public override {
        revert("Token Paused");
    }

    function mint(
        address, /*account*/
        uint256 /*amount*/
    ) public override {
        revert("Token Paused");
    }

    function approve(
        address, /*spender*/
        uint256 /*amount*/
    ) public override returns (bool) {
        revert("Token Paused");
    }

    function increaseAllowance(
        address, /*spender*/
        uint256 /*addedValue*/
    ) public override returns (bool) {
        revert("Token Paused");
    }

    function decreaseAllowance(
        address, /*spender*/
        uint256 /*subtractedValue*/
    ) public override returns (bool) {
        revert("Token Paused");
    }
}
