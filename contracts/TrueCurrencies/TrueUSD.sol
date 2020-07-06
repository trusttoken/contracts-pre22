// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "./TrueRewardBackedToken.sol";
import "./DelegateERC20.sol";


/** @title TrueUSD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract TrueUSD is TrueRewardBackedToken, DelegateERC20 {
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

    function canBurn() override internal pure returns (bytes32) {
        return "canBurn";
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) override(TrueRewardBackedToken, CompliantDepositTokenWithHook) internal returns (address) {
        return TrueRewardBackedToken._transferAllArgs(_from, _to, _value);
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) override(TrueRewardBackedToken, CompliantDepositTokenWithHook) internal returns (address) {
        return TrueRewardBackedToken._transferFromAllArgs(_from, _to, _value, _spender);
    }

    function balanceOf(address _who) override(TrueRewardBackedToken, ModularBasicToken) public view returns (uint256) {
        return TrueRewardBackedToken.balanceOf(_who);
    }

    function mint(address _to, uint256 _value) override(TrueRewardBackedToken, CompliantDepositTokenWithHook) public onlyOwner {
        return TrueRewardBackedToken.mint(_to, _value);
    }

    function totalSupply() override(TrueRewardBackedToken, ModularBasicToken) public view returns (uint256) {
        return TrueRewardBackedToken.totalSupply();
    }
}
