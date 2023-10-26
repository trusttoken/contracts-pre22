// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../base/BaseVerifyV1.sol";
import "../library/DefineRole.sol";

contract Message is BaseVerifyV1 {
  //////////////////// const

  //////////////////// var
  bytes12 public lastID;

  constructor(address configAddr) BaseVerifyV1(configAddr){
  }

  //////////////////// event
  // `from` addr get from transaction info
  event MessageData(bytes12 indexed id, bytes data);
  event KeyData(bytes12 indexed id, address indexed addr, bytes keyData);

  function MessageIDAllowed(bytes12 id)
    public
    view
    returns(bool){

    if(id < lastID){
      return false;
    }

    return true;
  }

  function IsValidID(bytes12 id)
    internal
    returns(bool){

    bool allow = MessageIDAllowed(id);

    if(!allow){
      return false;
    }

    if(id != lastID){
      lastID = id;
    }
    
    return true;
  }

  struct KeyInfo {
    address to;
    bytes keyData;
  }

  function BatchSendMessage(bytes12 id, bytes memory data, KeyInfo[] memory keyInfos)
    public
    onlyRole(DefineRole.MESSAGE_SENDER_ROLE){

    require(IsValidID(id), "not allowed id");
    
    emit MessageData(id, data);
    for(uint256 i = 0; i < keyInfos.length; i++){
      emit KeyData(id, keyInfos[i].to, keyInfos[i].keyData);
    }
  }
}
