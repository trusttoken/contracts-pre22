// SPDX-License-Identifier: PRIVATE
pragma solidity ^0.8.0;

library DefineConfigKey {

  // keccak256("CONFIG.COLD_ADDRESS_KEY")
  bytes32 internal constant COLD_ADDRESS_KEY = 0x5b1cb19c7ddceb51a3e40090a52db5ad5b06a3d73fd6f3f29b041ce76d124016;

  // keccak256("CONFIG.HOT_ADDRESS_KEY")
  bytes32 internal constant HOT_ADDRESS_KEY = 0x6f1d938f590171fe5edd52d7c9f2fe3812616b8d812bf983fbcb296e9daab184;

  // keccak256("CONFIG.TO_COLD_RATIO_KEY")
  bytes32 internal constant TO_COLD_RATIO_KEY = 0xc3d1b946ac7d7a660bee9ff000191134236fe0db380b4bb14844c693c953dbf2;
  
}
