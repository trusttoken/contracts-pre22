pragma solidity ^0.5.13;

/*
Defines the storage layout of the token implementaiton contract. Any newly declared
state variables in future upgrades should be appened to the bottom. Never remove state variables
from this list
 */
contract AssuredFinancialOpportunityStorage {

    // how much zTUSD we've issued (total supply)
    uint zTUSDIssued;

    // percentage of interest for staking pool
    // 1% = 10
    uint32 rewardBasis;

    // adjustment factor used when changing reward basis
    // we change the adjustment factor
    uint adjustmentFactor;

    // mintokenValue can never decrease
    uint minTokenValue;


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
