// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../base/BaseVerifyUpgradeableV1.sol";
import "../library/TransferHelper.sol";
import "../library/DefineRole.sol";
import "../library/DefineConfigKey.sol";

contract ChargeUpgradeable is BaseVerifyUpgradeableV1{
  //////////////////// constant

  //////////////////// storage

  //////////////////// init
  
  function initialize(address configAddr) public virtual initializer{
    __ChargeUpgradeable_init(configAddr);
  }

  function __ChargeUpgradeable_init(address configAddr) internal onlyInitializing{
    __BaseVerifyUpgradeableV1_init(configAddr);
  }

  //////////////////// public write
  function collect(address[] memory tokens, bool onlyToCold) public onlyRole(DefineRole.CHARGE_COLLECTOR_ROLE){
    address hotAddr;
    uint256 coldRatio;
    address coldAddr = config.getAddress(DefineConfigKey.COLD_ADDRESS_KEY);
    uint256 decimal = config.getDecimal();
    require(coldAddr != address(0x0), "cold addr is err");

    if(!onlyToCold){
      hotAddr = config.getAddress(DefineConfigKey.HOT_ADDRESS_KEY);
      coldRatio = config.getUInt256(DefineConfigKey.TO_COLD_RATIO_KEY);
      require(coldRatio <= decimal, "ratio is err");
      require(coldRatio < decimal && hotAddr != address(0x0), "hot addr is 0");
    }
    
    for(uint256 i = 0; i < tokens.length; i++){
      if(!onlyToCold){
        _collectToken(tokens[i], hotAddr, coldAddr, coldRatio, decimal);
      } else {
        _collectToken(tokens[i], address(0x0), coldAddr, decimal, decimal);
      }
    }
  }

  //////////////////// internal
  function _calcColdAndHot(uint256 amount, uint256 ratio, uint256 decimal)internal pure returns(uint256 toCold, uint256 toHot){

    if(ratio == decimal){
      return (amount, 0);
    }
    
    toCold = ratio * amount / decimal;
    toHot = amount - toCold;
    return (toCold, toHot);
  }
  
  function _collectToken(address token, address hotAddr, address coldAddr, uint256 ratio, uint256 decimal) internal{
    uint256 toCold;
    uint256 toHot;
    uint256 amount;

    // transfer eth
    if(token == address(0x0)){
      amount = address(this).balance;
      if(amount == 0){
        return;
      }
      
      (toCold, toHot) = _calcColdAndHot(amount, ratio, decimal);
      if(toCold > 0){
        payable(coldAddr).transfer(amount);
      }
      if(toHot > 0){
        payable(hotAddr).transfer(amount);
      }
      return;
    }
    
    IERC20 erc20Token = IERC20(token);
    amount = erc20Token.balanceOf(address(this));
    if(amount == 0){
      return;
    }

    (toCold, toHot) = _calcColdAndHot(amount, ratio, decimal);

    if(toCold > 0){
      TransferHelper.safeTransfer(token, coldAddr, toCold);
    }

    if(toHot > 0){
      TransferHelper.safeTransfer(token, hotAddr, toHot);
    }
  }
}
