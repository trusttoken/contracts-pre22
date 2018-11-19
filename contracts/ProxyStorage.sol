pragma solidity ^0.4.23;
import "../registry/contracts/Registry.sol";
import "./modularERC20/BalanceSheet.sol";
import "./modularERC20/AllowanceSheet.sol";
import "./utilities/GlobalPause.sol";

/*
Defines the storage layout of the implementaiton (TrueUSD) contract. Any newly declared 
state variables in future upgrades should be appened to the bottom. Never remove state variables
from this list
 */
contract ProxyStorage {
    address public owner;
    address public pendingOwner;

    bool public initialized;
    
    BalanceSheet public balances;
    AllowanceSheet public allowances;

    uint256 totalSupply_;
    
    bool public paused = false;
    GlobalPause public globalPause;

    uint256 public burnMin = 0;
    uint256 public burnMax = 0;

    Registry public registry;

    uint256 public transferFeeNumerator = 0;
    uint256 public transferFeeDenominator = 10000;
    uint256 public mintFeeNumerator = 0;
    uint256 public mintFeeDenominator = 10000;
    uint256 public mintFeeFlat = 0;
    uint256 public burnFeeNumerator = 0;
    uint256 public burnFeeDenominator = 10000;
    uint256 public burnFeeFlat = 0;
    // All transaction fees are paid to this address.
    address public staker;

    string public name = "TrueUSD";
    string public symbol = "TUSD";

    uint[] public gasRefundPool;
    uint256 public redemptionAddressCount;
}