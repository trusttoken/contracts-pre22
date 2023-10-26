// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

library DefineRole {

  //////////////////// constant
  bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;

  // const, keccak256("ADMIN_ROLE");
  bytes32 internal constant ADMIN_ROLE = 0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775;
  
  // keccak256("CHARGE_CREATER_ROLE")
  bytes32 internal constant CHARGE_CREATER_ROLE = 0x3e7b961ed06e2de676aa5a608963e476f31431390d1bdc45828051b537bbd0cf;

  // keccak256("CHARGE_COLLECTOR_ROLE")
  bytes32 internal constant CHARGE_COLLECTOR_ROLE = 0xbcefed0bc5b059ecc2c185678f6fbbaf7b07e3db4369d82765786e019a3c660d;
  
  // keccak256("HOT_WALLET_SENDER_ROLE")
  bytes32 internal constant HOT_WALLET_SENDER_ROLE = 0xcab4a03ceb5e75919e7d3335cb83750d2175b4d47d9756cf533a990e096e999c;

  // keccak256("MESSAGE_SENDER_ROLE")
  bytes32 internal constant MESSAGE_SENDER_ROLE = 0xd356a9f2bb2c5005afb3e9064d46f1063cf09fc700d0a7f2c8d65c22be4ee5bf;
  
  // keccak256("beacon.BEACON_UPGRADER") 
  bytes32 internal constant BEACON_UPGRADER = 0xfc89e8fcf76a4f1903edd1402e5aaf523e5c7aea361001808058bfbc1d541ed0;

  // keccak256("TOKEN_ISSUER_ROLE")
  bytes32 internal constant TOKEN_ISSUER_ROLE = 0xcac94cc97926b467b27e8ef2be28223f53520310d15d3903d606348ece1fa886;
  // keccak256("TOKEN_PAUSER_ROLE")
  bytes32 internal constant TOKEN_PAUSER_ROLE = 0xe95e22ec6dbf4c911d1fae59680a3e9cb71dd35b3a1c697d232e4b01a8ff30a2;
  // keccak256("TOKEN_MASTER_REDEEMER_ROLE")
  bytes32 internal constant TOKEN_MASTER_REDEEMER_ROLE = 0x20d211a4f3589bc5f0eb61061546fc6e9847fe4862aaca454b11f7067fff2843;
  // keccak256("TOKEN_REDEEMER_ROLE")
  bytes32 internal constant TOKEN_REDEEMER_ROLE = 0xa180e50b6d1ddf693d477f9a61e2a231f4babf66f6a687d7207888eb53d5c74b;
  // keccak256("TOKEN_BLACKLISTER_ROLE")
  bytes32 internal constant TOKEN_BLACKLISTER_ROLE = 0x4bbf5c10d9707e400e7cbb44a871ef5a738af1200cd71302d727218f1dc61a6b;
  
}
