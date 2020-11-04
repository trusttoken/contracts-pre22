// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

contract ProxyStorage {
    // Initializable.sol
    bool _initialized;
    bool _initializing;

    // Ownable.sol
    address _owner;

    // ERC20.sol
    mapping(address => uint256) _balances;
    mapping(address => mapping(address => uint256)) _allowances;
    uint256 _totalSupply;

    // TrueMintableBurnable.sol
    uint256 _minBurnAmount;
    uint256 _maxBurnAmount;

    /* Additionally, we have several keccak-based storage locations.
     * If you add more keccak-based storage mappings, such as mappings, you must document them here.
     * If the length of the keccak input is the same as an existing mapping, it is possible there could be a preimage collision.
     * A preimage collision can be used to attack the contract by treating one storage location as another,
     * which would always be a critical issue.
     * Carefully examine future keccak-based storage to ensure there can be no preimage collisions.
     *******************************************************************************************************
     ** length     input                                                         usage
     *******************************************************************************************************
     ** 20         "trueGold.proxy.owner"                                        Proxy Owner
     ** 28         "trueGold.pending.proxy.owner"                                Pending Proxy Owner
     ** 29         "trueGold.proxy.implementation"                               Proxy Implementation
     ** 64         uint256(address),uint256(1)                                   _balances
     ** 64         uint256(address),keccak256(uint256(address),uint256(2))       _allowances
     **/
}
