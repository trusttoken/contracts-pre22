// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../base/BaseVerifyUpgradeableV1.sol";
import "../library/TransferHelper.sol";
import "../library/DefineRole.sol";

interface BurnToken {
  function burn(uint256 amount) external;
}

contract HotWalletUpgradeable is BaseVerifyUpgradeableV1{
  //////////////////// constant
  
  //////////////////// storage

  //////////////////// event
  event transferInfo(address indexed token, address indexed to, bytes32 indexed id, uint256 amount);

  //////////////////// init
  function initialize(address configAddr) public virtual initializer{
    __HotWalletUpgradeable_init(configAddr);
  }

  function __HotWalletUpgradeable_init(address configAddr) internal onlyInitializing{
    __BaseVerifyUpgradeableV1_init(configAddr);
  }

  //////////////////// 
  function transfer(address token, address to, bytes32 id, uint256 amount) public onlyRole(DefineRole.HOT_WALLET_SENDER_ROLE){
    if(token == address(0x0)){
      payable(to).transfer(amount);
      emit transferInfo(token, to, id, amount);
      return;
    }

    TransferHelper.safeTransfer(token, to, amount);
    emit transferInfo(token, to, id, amount);
  }

  function burn(address token, uint256 amount) public onlyRole(DefineRole.HOT_WALLET_SENDER_ROLE){
    BurnToken(token).burn(amount);
  }
}
