// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../ValTokenWithHook.sol";

contract MockERC20Token is ValTokenWithHook {
  Registry registryAddress;

  function registry() public override view returns (Registry) {
    return registryAddress;
  }

  function setRegistry(Registry _registry) external {
    registryAddress = _registry;
  }

  function mint(address _to, uint256 _value) external {
    _mint(_to, _value);
  }

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
}
