pragma solidity ^0.4.23;
import "../registry/contracts/Registry.sol";
import "./modularERC20/BalanceSheet.sol";
import "./modularERC20/AllowanceSheet.sol";

/*
Defines the storage layout of the token implementaiton contract. Any newly declared
state variables in future upgrades should be appened to the bottom. Never remove state variables
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

    uint[] gasRefundPool_Deprecated;
    uint256 private redemptionAddressCount_Deprecated;
    uint256 public minimumGasPriceForFutureRefunds;

    mapping (address => uint256) _balanceOf;
    mapping (address => mapping (address => uint256)) _allowance;
    mapping (address => mapping (bytes32 => uint256)) attributes;


    /* Additionally, we have several keccak-based storage locations.
     * If you add more keccak-based storage mappings, such as mappings, you must document them here.
     * If the length of the keccak input is the same as an existing mapping, it is possible there could be a preimage collision.
     * A preimage collision can be used to attack the contract by treating one storage location as another,
     * which would always be a critical issue.
     *************************************************************************
     ** length     input                              usage
     *************************************************************************
     ** 19         "trueXXX.proxy.owner"              Proxy Owner
     ** 20         address                            balanceOf
     ** 27         "trueXXX.pending.proxy.owner"      Pending Proxy Owner
     ** 28         "trueXXX.proxy.implementation"     Proxy Implementation
     ** 32         uint256(11)                        gasRefundPool_Deprecated
     ** 40         address,address                    allowance
     ** 52         address,bytes32                    Registry attributes
    **/
}
