// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;
// solhint-disable max-states-count, var-name-mixedcase

import {Registry} from "../registry/Registry.sol";
import {BalanceSheet} from "./deprecated/BalanceSheet.sol";
import {AllowanceSheet} from "./deprecated/AllowanceSheet.sol";
import {FinancialOpportunity} from "../truereward/FinancialOpportunity.sol";

/*
Defines the storage layout of the token implementation contract. Any newly declared
state variables in future upgrades should be appended to the bottom. Never remove state variables
from this list
 */
contract ProxyStorage {
    address public owner;
    address public pendingOwner;

    bool initialized;

    BalanceSheet balances_Deprecated;
    AllowanceSheet allowances_Deprecated;

    uint256 totalSupply_;

    bool private paused_Deprecated = false;
    address private globalPause_Deprecated;

    uint256 public burnMin = 0;
    uint256 public burnMax = 0;

    Registry public registry;

    string name_Deprecated;
    string symbol_Deprecated;

    uint256[] gasRefundPool_Deprecated;
    uint256 private redemptionAddressCount_Deprecated;
    uint256 public minimumGasPriceForFutureRefunds;

    mapping(address => uint256) _balanceOf;
    mapping(address => mapping(address => uint256)) _allowance;
    mapping(bytes32 => mapping(address => uint256)) attributes;

    // reward token storage
    mapping(address => FinancialOpportunity) finOps;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;

    // true reward allocation
    // proportion: 1000 = 100%
    struct RewardAllocation {
        uint256 proportion;
        address finOp;
    }
    mapping(address => RewardAllocation[]) _rewardDistribution;
    uint256 maxRewardProportion = 1000;

    /* Additionally, we have several keccak-based storage locations.
     * If you add more keccak-based storage mappings, such as mappings, you must document them here.
     * If the length of the keccak input is the same as an existing mapping, it is possible there could be a preimage collision.
     * A preimage collision can be used to attack the contract by treating one storage location as another,
     * which would always be a critical issue.
     * Carefully examine future keccak-based storage to ensure there can be no preimage collisions.
     *******************************************************************************************************
     ** length     input                                                         usage
     *******************************************************************************************************
     ** 19         "trueXXX.proxy.owner"                                         Proxy Owner
     ** 27         "trueXXX.pending.proxy.owner"                                 Pending Proxy Owner
     ** 28         "trueXXX.proxy.implementation"                                Proxy Implementation
     ** 32         uint256(11)                                                   gasRefundPool_Deprecated
     ** 64         uint256(address),uint256(14)                                  balanceOf
     ** 64         uint256(address),keccak256(uint256(address),uint256(15))      allowance
     ** 64         uint256(address),keccak256(bytes32,uint256(16))               attributes
     **/
}
