// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ModularBurnableToken} from "./modularERC20/ModularBurnableToken.sol";
import {ModularBasicToken} from "./modularERC20/ModularBasicToken.sol";
import {TrueRewardBackedToken} from "./TrueRewardBackedToken.sol";
import {DelegateERC20, CompliantDepositTokenWithHook} from "./DelegateERC20.sol";

/** @title TrueUSD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract TrueUSDLegacy is TrueRewardBackedToken, DelegateERC20 {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure returns (string memory) {
        return "TrueUSD";
    }

    function symbol() public pure returns (string memory) {
        return "TUSD";
    }

    function canBurn() internal override pure returns (bytes32) {
        return "canBurn";
    }

    function _transferAllArgs(
        address _from,
        address _to,
        uint256 _value
    ) internal override(TrueRewardBackedToken, CompliantDepositTokenWithHook) returns (address) {
        return TrueRewardBackedToken._transferAllArgs(_from, _to, _value);
    }

    function _transferFromAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal override(TrueRewardBackedToken, CompliantDepositTokenWithHook) returns (address) {
        return TrueRewardBackedToken._transferFromAllArgs(_from, _to, _value, _spender);
    }

    function balanceOf(address _who) public override(TrueRewardBackedToken, ModularBasicToken) view returns (uint256) {
        return TrueRewardBackedToken.balanceOf(_who);
    }

    function mint(address _to, uint256 _value) public override(TrueRewardBackedToken, CompliantDepositTokenWithHook) onlyOwner {
        return TrueRewardBackedToken.mint(_to, _value);
    }

    function totalSupply() public override(TrueRewardBackedToken, ModularBasicToken) view returns (uint256) {
        return TrueRewardBackedToken.totalSupply();
    }
}
