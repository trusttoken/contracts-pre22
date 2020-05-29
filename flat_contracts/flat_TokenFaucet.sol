
// File: openzeppelin-solidity/contracts/token/ERC20/IERC20.sol

pragma solidity ^0.5.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP. Does not include
 * the optional functions; to access them see {ERC20Detailed}.
 */
interface IERC20 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// File: @trusttoken/registry/contracts/Registry.sol

pragma solidity ^0.5.13;


interface RegistryClone {
    function syncAttributeValue(address _who, bytes32 _attribute, uint256 _value) external;
}

contract Registry {
    struct AttributeData {
        uint256 value;
        bytes32 notes;
        address adminAddr;
        uint256 timestamp;
    }
    
    // never remove any storage variables
    address public owner;
    address public pendingOwner;
    bool initialized;

    // Stores arbitrary attributes for users. An example use case is an IERC20
    // token that requires its users to go through a KYC/AML check - in this case
    // a validator can set an account's "hasPassedKYC/AML" attribute to 1 to indicate
    // that account can use the token. This mapping stores that value (1, in the
    // example) as well as which validator last set the value and at what time,
    // so that e.g. the check can be renewed at appropriate intervals.
    mapping(address => mapping(bytes32 => AttributeData)) attributes;
    // The logic governing who is allowed to set what attributes is abstracted as
    // this accessManager, so that it may be replaced by the owner as needed
    bytes32 constant WRITE_PERMISSION = keccak256("canWriteTo-");
    mapping(bytes32 => RegistryClone[]) subscribers;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );
    event SetAttribute(address indexed who, bytes32 attribute, uint256 value, bytes32 notes, address indexed adminAddr);
    event SetManager(address indexed oldManager, address indexed newManager);
    event StartSubscription(bytes32 indexed attribute, RegistryClone indexed subscriber);
    event StopSubscription(bytes32 indexed attribute, RegistryClone indexed subscriber);

    // Allows a write if either a) the writer is that Registry's owner, or
    // b) the writer is writing to attribute foo and that writer already has
    // the canWriteTo-foo attribute set (in that same Registry)
    function confirmWrite(bytes32 _attribute, address _admin) internal view returns (bool) {
        return (_admin == owner || hasAttribute(_admin, keccak256(abi.encodePacked(WRITE_PERMISSION ^ _attribute))));
    }

    // Writes are allowed only if the accessManager approves
    function setAttribute(address _who, bytes32 _attribute, uint256 _value, bytes32 _notes) public {
        require(confirmWrite(_attribute, msg.sender));
        attributes[_who][_attribute] = AttributeData(_value, _notes, msg.sender, block.timestamp);
        emit SetAttribute(_who, _attribute, _value, _notes, msg.sender);

        RegistryClone[] storage targets = subscribers[_attribute];
        uint256 index = targets.length;
        while (index --> 0) {
            targets[index].syncAttributeValue(_who, _attribute, _value);
        }
    }

    function subscribe(bytes32 _attribute, RegistryClone _syncer) external onlyOwner {
        subscribers[_attribute].push(_syncer);
        emit StartSubscription(_attribute, _syncer);
    }

    function unsubscribe(bytes32 _attribute, uint256 _index) external onlyOwner {
        uint256 length = subscribers[_attribute].length;
        require(_index < length);
        emit StopSubscription(_attribute, subscribers[_attribute][_index]);
        subscribers[_attribute][_index] = subscribers[_attribute][length - 1];
        subscribers[_attribute].length = length - 1;
    }

    function subscriberCount(bytes32 _attribute) public view returns (uint256) {
        return subscribers[_attribute].length;
    }

    function setAttributeValue(address _who, bytes32 _attribute, uint256 _value) public {
        require(confirmWrite(_attribute, msg.sender));
        attributes[_who][_attribute] = AttributeData(_value, "", msg.sender, block.timestamp);
        emit SetAttribute(_who, _attribute, _value, "", msg.sender);
        RegistryClone[] storage targets = subscribers[_attribute];
        uint256 index = targets.length;
        while (index --> 0) {
            targets[index].syncAttributeValue(_who, _attribute, _value);
        }
    }

    // Returns true if the uint256 value stored for this attribute is non-zero
    function hasAttribute(address _who, bytes32 _attribute) public view returns (bool) {
        return attributes[_who][_attribute].value != 0;
    }


    // Returns the exact value of the attribute, as well as its metadata
    function getAttribute(address _who, bytes32 _attribute) public view returns (uint256, bytes32, address, uint256) {
        AttributeData memory data = attributes[_who][_attribute];
        return (data.value, data.notes, data.adminAddr, data.timestamp);
    }

    function getAttributeValue(address _who, bytes32 _attribute) public view returns (uint256) {
        return attributes[_who][_attribute].value;
    }

    function getAttributeAdminAddr(address _who, bytes32 _attribute) public view returns (address) {
        return attributes[_who][_attribute].adminAddr;
    }

    function getAttributeTimestamp(address _who, bytes32 _attribute) public view returns (uint256) {
        return attributes[_who][_attribute].timestamp;
    }

    function syncAttribute(bytes32 _attribute, uint256 _startIndex, address[] calldata _addresses) external {
        RegistryClone[] storage targets = subscribers[_attribute];
        uint256 index = targets.length;
        while (index --> _startIndex) {
            RegistryClone target = targets[index];
            for (uint256 i = _addresses.length; i --> 0; ) {
                address who = _addresses[i];
                target.syncAttributeValue(who, _attribute, attributes[who][_attribute].value);
            }
        }
    }

    function reclaimEther(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    function reclaimToken(IERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }

   /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "only Owner");
        _;
    }

    /**
    * @dev Modifier throws if called by any account other than the pendingOwner.
    */
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner);
        _;
    }

    /**
    * @dev Allows the current owner to set the pendingOwner address.
    * @param newOwner The address to transfer ownership to.
    */
    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner = newOwner;
    }

    /**
    * @dev Allows the pendingOwner address to finalize the transfer.
    */
    function claimOwnership() public onlyPendingOwner {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

// File: contracts/TrueCurrencies/modularERC20/InstantiatableOwnable.sol

pragma solidity ^0.5.13;


/**
 * @title InstantiatableOwnable
 * @dev The InstantiatableOwnable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract InstantiatableOwnable {
    address public owner;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev The InstantiatableOwnable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    constructor() public {
        owner = msg.sender;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

// File: contracts/TrueCurrencies/modularERC20/Claimable.sol

pragma solidity ^0.5.13;



/**
 * @title Claimable
 * @dev Extension for the InstantiatableOwnable contract, where the ownership needs to be claimed.
 * This allows the new owner to accept the transfer.
 */
contract Claimable is InstantiatableOwnable {
    address public pendingOwner;

    /**
     * @dev Modifier throws if called by any account other than the pendingOwner.
     */
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner);
        _;
    }

    /**
     * @dev Allows the current owner to set the pendingOwner address.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner = newOwner;
    }

    /**
     * @dev Allows the pendingOwner address to finalize the transfer.
     */
    function claimOwnership() public onlyPendingOwner {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

// File: openzeppelin-solidity/contracts/math/SafeMath.sol

pragma solidity ^0.5.0;

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     *
     * _Available since v2.4.0._
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * _Available since v2.4.0._
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * _Available since v2.4.0._
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

// File: contracts/TrueCurrencies/modularERC20/BalanceSheet.sol

pragma solidity ^0.5.13;



// A wrapper around the balanceOf mapping.
contract BalanceSheet is Claimable {
    using SafeMath for uint256;

    mapping (address => uint256) public balanceOf;

    function addBalance(address _addr, uint256 _value) public onlyOwner {
        balanceOf[_addr] = balanceOf[_addr].add(_value);
    }

    function subBalance(address _addr, uint256 _value) public onlyOwner {
        balanceOf[_addr] = balanceOf[_addr].sub(_value);
    }

    function setBalance(address _addr, uint256 _value) public onlyOwner {
        balanceOf[_addr] = _value;
    }
}

// File: contracts/TrueCurrencies/modularERC20/AllowanceSheet.sol

pragma solidity ^0.5.13;



// A wrapper around the allowanceOf mapping.
contract AllowanceSheet is Claimable {
    using SafeMath for uint256;

    mapping (address => mapping (address => uint256)) public allowanceOf;

    function addAllowance(address _tokenHolder, address _spender, uint256 _value) public onlyOwner {
        allowanceOf[_tokenHolder][_spender] = allowanceOf[_tokenHolder][_spender].add(_value);
    }

    function subAllowance(address _tokenHolder, address _spender, uint256 _value) public onlyOwner {
        allowanceOf[_tokenHolder][_spender] = allowanceOf[_tokenHolder][_spender].sub(_value);
    }

    function setAllowance(address _tokenHolder, address _spender, uint256 _value) public onlyOwner {
        allowanceOf[_tokenHolder][_spender] = _value;
    }
}

// File: contracts/TrueCurrencies/ProxyStorage.sol

pragma solidity ^0.5.13;




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
    mapping (bytes32 => mapping (address => uint256)) attributes;

    struct FinancialOpportunityAllocation { address financialOpportunity; uint proportion; }
    mapping(address => FinancialOpportunityAllocation[]) _trueRewardDistribution;
    mapping (address => mapping (address => uint256)) _financialOpportunityBalances;

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

// File: contracts/TrueCurrencies/HasOwner.sol

pragma solidity ^0.5.13;


/**
 * @title HasOwner
 * @dev The HasOwner contract is a copy of Claimable Contract by Zeppelin.
 and provides basic authorization control functions. Inherits storage layout of
 ProxyStorage.
 */
contract HasOwner is ProxyStorage {

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
    * @dev sets the original `owner` of the contract to the sender
    * at construction. Must then be reinitialized
    */
    constructor() public {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "only Owner");
        _;
    }

    /**
    * @dev Modifier throws if called by any account other than the pendingOwner.
    */
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner);
        _;
    }

    /**
    * @dev Allows the current owner to set the pendingOwner address.
    * @param newOwner The address to transfer ownership to.
    */
    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner = newOwner;
    }

    /**
    * @dev Allows the pendingOwner address to finalize the transfer.
    */
    function claimOwnership() public onlyPendingOwner {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

// File: contracts/TrueCurrencies/TrueCoinReceiver.sol

pragma solidity ^0.5.13;

contract TrueCoinReceiver {
    function tokenFallback( address from, uint256 value ) external;
}

// File: contracts/TrueCurrencies/ReclaimerToken.sol

pragma solidity ^0.5.13;


contract ReclaimerToken is HasOwner {
    /**
    *@dev send all eth balance in the contract to another address
    */
    function reclaimEther(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**
    *@dev send all token balance of an arbitary erc20 token
    in the contract to another address
    */
    function reclaimToken(IERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }

    /**
    *@dev allows owner of the contract to gain ownership of any contract that the contract currently owns
    */
    function reclaimContract(InstantiatableOwnable _ownable) external onlyOwner {
        _ownable.transferOwnership(owner);
    }
}

// File: contracts/TrueCurrencies/modularERC20/InitializableOwnable.sol

pragma solidity ^0.5.13;


/**
 * @title InitializableOwnable
 * @dev The InitializableOwnable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract InitializableOwnable {
    address public owner;
    bool configured = false;

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev The InitializableOwnable constructor sets the original `owner` of the contract to the sender
     * account.
     */
    function _configure() internal {
        require(!configured);
        owner = msg.sender;
        configured = true;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Allows the current owner to transfer control of the contract to a newOwner.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0));
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

// File: contracts/TrueCurrencies/modularERC20/InitializableClaimable.sol

pragma solidity ^0.5.13;



/**
 * @title InitializableOwnable
 * @dev Extension for the InstantiatableOwnable contract, where the ownership needs to be claimed.
 * This allows the new owner to accept the transfer.
 */
contract InitializableClaimable is InitializableOwnable {
    address public pendingOwner;

    /**
     * @dev Modifier throws if called by any account other than the pendingOwner.
     */
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner);
        _;
    }

    /**
     * @dev Allows the current owner to set the pendingOwner address.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner = newOwner;
    }

    /**
     * @dev Allows the pendingOwner address to finalize the transfer.
     */
    function claimOwnership() public onlyPendingOwner {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }
}

// File: contracts/TrueCurrencies/modularERC20/ModularBasicToken.sol

pragma solidity ^0.5.13;





// Fork of OpenZeppelin's BasicToken
/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract ModularBasicToken is HasOwner {
    using SafeMath for uint256;

    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
    * @dev total number of tokens in existence
    */
    function totalSupply() public view returns (uint256) {
        return totalSupply_;
    }

    function balanceOf(address _who) public view returns (uint256) {
        return _getBalance(_who);
    }

    function _getBalance(address _who) internal view returns (uint256) {
        return _balanceOf[_who];
    }

    function _addBalance(address _who, uint256 _value) internal returns (uint256 priorBalance) {
        priorBalance = _balanceOf[_who];
        _balanceOf[_who] = priorBalance.add(_value);
    }

    function _subBalance(address _who, uint256 _value) internal returns (uint256 result) {
        result = _balanceOf[_who].sub(_value);
        _balanceOf[_who] = result;
    }

    function _setBalance(address _who, uint256 _value) internal {
        _balanceOf[_who] = _value;
    }
}

// File: contracts/TrueCurrencies/modularERC20/ModularStandardToken.sol

pragma solidity ^0.5.13;




/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic standard token.
 * @dev https://github.com/ethereum/EIPs/issues/20
 * @dev Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract ModularStandardToken is ModularBasicToken {
    using SafeMath for uint256;

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    uint256 constant INFINITE_ALLOWANCE = 0xfe00000000000000000000000000000000000000000000000000000000000000;

    /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     *
     * Beware that changing an allowance with this method brings the risk that someone may use both the old
     * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
     * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     * @param _spender The address which will spend the funds.
     * @param _value The amount of tokens to be spent.
     */
    function approve(address _spender, uint256 _value) public returns (bool) {
        _approveAllArgs(_spender, _value, msg.sender);
        return true;
    }

    function _approveAllArgs(
        address _spender,
        uint256 _value,
        address _tokenHolder
    ) internal {
        _setAllowance(_tokenHolder, _spender, _value);
        emit Approval(_tokenHolder, _spender, _value);
    }

    /**
     * @dev Increase the amount of tokens that an owner allowed to a spender.
     *
     * approve should be called when allowed[_spender] == 0. To increment
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param _spender The address which will spend the funds.
     * @param _addedValue The amount of tokens to increase the allowance by.
     */
    function increaseAllowance(address _spender, uint256 _addedValue)
        public
        returns (bool)
    {
        _increaseAllowanceAllArgs(_spender, _addedValue, msg.sender);
        return true;
    }

    function _increaseAllowanceAllArgs(
        address _spender,
        uint256 _addedValue,
        address _tokenHolder
    ) internal {
        _addAllowance(_tokenHolder, _spender, _addedValue);
        emit Approval(
            _tokenHolder,
            _spender,
            _getAllowance(_tokenHolder, _spender)
        );
    }

    /**
     * @dev Decrease the amount of tokens that an owner allowed to a spender.
     *
     * approve should be called when allowed[_spender] == 0. To decrement
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param _spender The address which will spend the funds.
     * @param _subtractedValue The amount of tokens to decrease the allowance by.
     */
    function decreaseAllowance(address _spender, uint256 _subtractedValue)
        public
        returns (bool)
    {
        _decreaseAllowanceAllArgs(_spender, _subtractedValue, msg.sender);
        return true;
    }

    function _decreaseAllowanceAllArgs(
        address _spender,
        uint256 _subtractedValue,
        address _tokenHolder
    ) internal {
        uint256 oldValue = _getAllowance(_tokenHolder, _spender);
        uint256 newValue;
        if (_subtractedValue > oldValue) {
            newValue = 0;
        } else {
            newValue = oldValue - _subtractedValue;
        }
        _setAllowance(_tokenHolder, _spender, newValue);
        emit Approval(_tokenHolder, _spender, newValue);
    }

    function allowance(address _who, address _spender)
        public
        view
        returns (uint256)
    {
        return _getAllowance(_who, _spender);
    }

    function _getAllowance(address _who, address _spender)
        internal
        view
        returns (uint256 value)
    {
        return _allowance[_who][_spender];
    }

    function _addAllowance(address _who, address _spender, uint256 _value)
        internal
    {
        _allowance[_who][_spender] = _allowance[_who][_spender].add(_value);
    }

    function _subAllowance(address _who, address _spender, uint256 _value)
        internal
        returns (uint256 newAllowance)
    {
        newAllowance = _allowance[_who][_spender].sub(_value);
        if (newAllowance < INFINITE_ALLOWANCE) {
            _allowance[_who][_spender] = newAllowance;
        }
    }

    function _setAllowance(address _who, address _spender, uint256 _value)
        internal
    {
        _allowance[_who][_spender] = _value;
    }
}

// File: contracts/TrueCurrencies/modularERC20/ModularBurnableToken.sol

pragma solidity ^0.5.13;


/**
 * @title Burnable Token
 * @dev Token that can be irreversibly burned (destroyed).
 */
contract ModularBurnableToken is ModularStandardToken {
    event Burn(address indexed burner, uint256 value);
    event Mint(address indexed to, uint256 value);
    uint256 constant CENT = 10 ** 16;

    function burn(uint256 _value) external {
        _burnAllArgs(msg.sender, _value - _value % CENT);
    }

    function _burnAllArgs(address _from, uint256 _value) internal {
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure
        _subBalance(_from, _value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_from, _value);
        emit Transfer(_from, address(0), _value);
    }
}

// File: contracts/TrueCurrencies/BurnableTokenWithBounds.sol

pragma solidity ^0.5.13;


/**
 * @title Burnable Token WithBounds
 * @dev Burning functions as redeeming money from the system. The platform will keep track of who burns coins,
 * and will send them back the equivalent amount of money (rounded down to the nearest cent).
 */
contract BurnableTokenWithBounds is ModularBurnableToken {

    event SetBurnBounds(uint256 newMin, uint256 newMax);

    function _burnAllArgs(address _burner, uint256 _value) internal {
        require(_value >= burnMin, "below min burn bound");
        require(_value <= burnMax, "exceeds max burn bound");
        super._burnAllArgs(_burner, _value);
    }

    //Change the minimum and maximum amount that can be burned at once. Burning
    //may be disabled by setting both to 0 (this will not be done under normal
    //operation, but we can't add checks to disallow it without losing a lot of
    //flexibility since burning could also be as good as disabled
    //by setting the minimum extremely high, and we don't want to lock
    //in any particular cap for the minimum)
    function setBurnBounds(uint256 _min, uint256 _max) external onlyOwner {
        require(_min <= _max, "min > max");
        burnMin = _min;
        burnMax = _max;
        emit SetBurnBounds(_min, _max);
    }
}

// File: contracts/TrueCurrencies/GasRefundToken.sol

pragma solidity ^0.5.13;


/**
@title Gas Refund Token
Allow any user to sponsor gas refunds for transfer and mints. Utilitzes the gas refund mechanism in EVM
Each time an non-empty storage slot is set to 0, evm refund 15,000 to the sender
of the transaction.
*/
contract GasRefundToken is ProxyStorage {

    /**
      A buffer of "Sheep" runs from 0xffff...fffe down
      They suicide when you call them, if you are their parent
    */

    function sponsorGas2() external {
        /**
        Deploy (9 bytes)
          PC Assembly       Opcodes                                       Stack
          00 PUSH1(27)      60 1b                                         1b
          02 DUP1           80                                            1b 1b
          03 PUSH1(9)       60 09                                         1b 1b 09
          05 RETURNDATASIZE 3d                                            1b 1b 09 00
          06 CODECOPY       39                                            1b
          07 RETURNDATASIZE 3d                                            1b 00
          08 RETURN         f3
        Sheep (27 bytes = 3 + 20 + 4)
          PC Assembly       Opcodes                                       Stack
          00 RETURNDATASIZE 3d                                            00
          01 CALLER         33                                            00 caller
          02 PUSH20(me)     73 memememememememememememememememememememe   00 caller me
          17 XOR            18                                            00 invalid
          18 PC             58                                            00 invalid 18
          19 JUMPI          57                                            00
          1a SELFDESTRUCT   ff
        */
        assembly {
            mstore(0, or(0x601b8060093d393df33d33730000000000000000000000000000000000000000, address))
            mstore(32,   0x185857ff00000000000000000000000000000000000000000000000000000000)
            let offset := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
            let location := sub(0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffe, offset)
            sstore(location, create(0, 0, 0x24))
            location := sub(location, 1)
            sstore(location, create(0, 0, 0x24))
            location := sub(location, 1)
            sstore(location, create(0, 0, 0x24))
            sstore(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, add(offset, 3))
        }
    }

    /**
    @dev refund 39,000 gas
    @dev costs slightly more than 16,100 gas
    */
    function gasRefund39() internal {
        assembly {
            let offset := sload(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff)
            if gt(offset, 0) {
              let location := sub(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff,offset)
              sstore(0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff, sub(offset, 1))
              let sheep := sload(location)
              pop(call(gas, sheep, 0, 0, 0, 0, 0))
              sstore(location, 0)
            }
        }
    }

    function sponsorGas() external {
        uint256 refundPrice = minimumGasPriceForFutureRefunds;
        require(refundPrice > 0);
        assembly {
            let offset := sload(0xfffff)
            let result := add(offset, 9)
            sstore(0xfffff, result)
            let position := add(offset, 0x100000)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
            position := add(position, 1)
            sstore(position, refundPrice)
        }
    }

    function minimumGasPriceForRefund() public view returns (uint256 result) {
        assembly {
            let offset := sload(0xfffff)
            let location := add(offset, 0xfffff)
            result := add(sload(location), 1)
        }
    }

    /**
    @dev refund 30,000 gas
    @dev costs slightly more than 15,400 gas
    */
    function gasRefund30() internal {
        assembly {
            let offset := sload(0xfffff)
            if gt(offset, 1) {
                let location := add(offset, 0xfffff)
                if gt(gasprice,sload(location)) {
                    sstore(location, 0)
                    location := sub(location, 1)
                    sstore(location, 0)
                    sstore(0xfffff, sub(offset, 2))
                }
            }
        }
    }

    /**
    @dev refund 15,000 gas
    @dev costs slightly more than 10,200 gas
    */
    function gasRefund15() internal {
        assembly {
            let offset := sload(0xfffff)
            if gt(offset, 1) {
                let location := add(offset, 0xfffff)
                if gt(gasprice,sload(location)) {
                    sstore(location, 0)
                    sstore(0xfffff, sub(offset, 1))
                }
            }
        }
    }

    /**
    *@dev Return the remaining sponsored gas slots
    */
    function remainingGasRefundPool() public view returns (uint length) {
        assembly {
            length := sload(0xfffff)
        }
    }

    function gasRefundPool(uint256 _index) public view returns (uint256 gasPrice) {
        assembly {
            gasPrice := sload(add(0x100000, _index))
        }
    }

    bytes32 constant CAN_SET_FUTURE_REFUND_MIN_GAS_PRICE = "canSetFutureRefundMinGasPrice";

    function setMinimumGasPriceForFutureRefunds(uint256 _minimumGasPriceForFutureRefunds) public {
        require(registry.hasAttribute(msg.sender, CAN_SET_FUTURE_REFUND_MIN_GAS_PRICE));
        minimumGasPriceForFutureRefunds = _minimumGasPriceForFutureRefunds;
    }
}

// File: contracts/TrueCurrencies/CompliantDepositTokenWithHook.sol

pragma solidity ^0.5.13;







contract CompliantDepositTokenWithHook is ReclaimerToken, RegistryClone, BurnableTokenWithBounds, GasRefundToken {

    bytes32 constant IS_REGISTERED_CONTRACT = "isRegisteredContract";
    bytes32 constant IS_DEPOSIT_ADDRESS = "isDepositAddress";
    uint256 constant REDEMPTION_ADDRESS_COUNT = 0x100000;
    bytes32 constant IS_BLACKLISTED = "isBlacklisted";

    function canBurn() internal pure returns (bytes32);

    /**
    * @dev transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        _transferAllArgs(msg.sender, _to, _value);
        return true;
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        _transferFromAllArgs(_from, _to, _value, msg.sender);
        return true;
    }

    function _burnFromAllowanceAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        _requireCanTransferFrom(_spender, _from, _to);
        _requireOnlyCanBurn(_to);
        require(_value >= burnMin, "below min burn bound");
        require(_value <= burnMax, "exceeds max burn bound");
        if (0 == _subBalance(_from, _value)) {
            if (0 != _subAllowance(_from, _spender, _value)) {
                gasRefund15();
            }
            // else no refund
        } else {
            if (0 == _subAllowance(_from, _spender, _value)) {
                gasRefund15();
            } else {
                gasRefund39();
            }
        }
        emit Transfer(_from, _to, _value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_to, _value);
        emit Transfer(_to, address(0), _value);
    }

    function _burnFromAllArgs(address _from, address _to, uint256 _value) internal {
        _requireCanTransfer(_from, _to);
        _requireOnlyCanBurn(_to);
        require(_value >= burnMin, "below min burn bound");
        require(_value <= burnMax, "exceeds max burn bound");
        if (0 == _subBalance(_from, _value)) {
            gasRefund15();
        } else {
            gasRefund30();
        }
        emit Transfer(_from, _to, _value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_to, _value);
        emit Transfer(_to, address(0), _value);
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        if (uint256(_to) < REDEMPTION_ADDRESS_COUNT) {
            _value -= _value % CENT;
            _burnFromAllowanceAllArgs(_from, _to, _value, _spender);
        } else {
            bool hasHook;
            address originalTo = _to;
            (_to, hasHook) = _requireCanTransferFrom(_spender, _from, _to);
            if (0 == _addBalance(_to, _value)) {
                if (0 == _subAllowance(_from, _spender, _value)) {
                    if (0 != _subBalance(_from, _value)) {
                        gasRefund30();
                    }
                    // else do not refund
                } else {
                    if (0 == _subBalance(_from, _value)) {
                        gasRefund30();
                    } else {
                        gasRefund39();
                    }
                }
            } else {
                if (0 == _subAllowance(_from, _spender, _value)) {
                    if (0 != _subBalance(_from, _value)) {
                        gasRefund15();
                    }
                    // else do not refund
                } else {
                    if (0 == _subBalance(_from, _value)) {
                        gasRefund15();
                    } else {
                        gasRefund39();
                    }
                }

            }
            emit Transfer(_from, originalTo, _value);
            if (originalTo != _to) {
                emit Transfer(originalTo, _to, _value);
                if (hasHook) {
                    TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(_to).tokenFallback(_from, _value);
                }
            }
        }
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        if (uint256(_to) < REDEMPTION_ADDRESS_COUNT) {
            _value -= _value % CENT;
            _burnFromAllArgs(_from, _to, _value);
        } else {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            if (0 == _subBalance(_from, _value)) {
                if (0 == _addBalance(finalTo, _value)) {
                    gasRefund30();
                }
                // else do not refund
            } else {
                if (0 == _addBalance(finalTo, _value)) {
                    gasRefund39();
                } else {
                    gasRefund30();
                }
            }
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        }
    }

    function mint(address _to, uint256 _value) public onlyOwner {
        require(_to != address(0), "to address cannot be zero");
        bool hasHook;
        address originalTo = _to;
        (_to, hasHook) = _requireCanMint(_to);
        totalSupply_ = totalSupply_.add(_value);
        emit Mint(originalTo, _value);
        emit Transfer(address(0), originalTo, _value);
        if (_to != originalTo) {
            emit Transfer(originalTo, _to, _value);
        }
        _addBalance(_to, _value);
        if (hasHook) {
            if (_to != originalTo) {
                TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
            } else {
                TrueCoinReceiver(_to).tokenFallback(address(0), _value);
            }
        }
    }

    event WipeBlacklistedAccount(address indexed account, uint256 balance);
    event SetRegistry(address indexed registry);

    /**
    * @dev Point to the registry that contains all compliance related data
    @param _registry The address of the registry instance
    */
    function setRegistry(Registry _registry) public onlyOwner {
        registry = _registry;
        emit SetRegistry(address(registry));
    }

    modifier onlyRegistry {
        require(msg.sender == address(registry));
        _;
    }

    function syncAttributeValue(address _who, bytes32 _attribute, uint256 _value) public onlyRegistry {
        attributes[_attribute][_who] = _value;
    }

    function _burnAllArgs(address _from, uint256 _value) internal {
        _requireCanBurn(_from);
        super._burnAllArgs(_from, _value);
    }

    // Destroy the tokens owned by a blacklisted account
    function wipeBlacklistedAccount(address _account) public onlyOwner {
        require(_isBlacklisted(_account), "_account is not blacklisted");
        uint256 oldValue = _getBalance(_account);
        _setBalance(_account, 0);
        totalSupply_ = totalSupply_.sub(oldValue);
        emit WipeBlacklistedAccount(_account, oldValue);
        emit Transfer(_account, address(0), oldValue);
    }

    function _isBlacklisted(address _account) internal view returns (bool blacklisted) {
        return attributes[IS_BLACKLISTED][_account] != 0;
    }

    function _requireCanTransfer(address _from, address _to) internal view returns (address, bool) {
        uint256 depositAddressValue = attributes[IS_DEPOSIT_ADDRESS][address(uint256(_to) >> 20)];
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        require (attributes[IS_BLACKLISTED][_to] == 0, "blacklisted");
        require (attributes[IS_BLACKLISTED][_from] == 0, "blacklisted");
        return (_to, attributes[IS_REGISTERED_CONTRACT][_to] != 0);
    }

    function _requireCanTransferFrom(address _spender, address _from, address _to) internal view returns (address, bool) {
        require (attributes[IS_BLACKLISTED][_spender] == 0, "blacklisted");
        uint256 depositAddressValue = attributes[IS_DEPOSIT_ADDRESS][address(uint256(_to) >> 20)];
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        require (attributes[IS_BLACKLISTED][_to] == 0, "blacklisted");
        require (attributes[IS_BLACKLISTED][_from] == 0, "blacklisted");
        return (_to, attributes[IS_REGISTERED_CONTRACT][_to] != 0);
    }

    function _requireCanMint(address _to) internal view returns (address, bool) {
        uint256 depositAddressValue = attributes[IS_DEPOSIT_ADDRESS][address(uint256(_to) >> 20)];
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        require (attributes[IS_BLACKLISTED][_to] == 0, "blacklisted");
        return (_to, attributes[IS_REGISTERED_CONTRACT][_to] != 0);
    }

    function _requireOnlyCanBurn(address _from) internal view {
        require (attributes[canBurn()][_from] != 0, "cannot burn from this address");
    }

    function _requireCanBurn(address _from) internal view {
        require (attributes[IS_BLACKLISTED][_from] == 0, "blacklisted");
        require (attributes[canBurn()][_from] != 0, "cannot burn from this address");
    }

    function paused() public pure returns (bool) {
        return false;
    }
}

// File: contracts/TrueReward/FinancialOpportunity.sol

pragma solidity ^0.5.13;

/**
 * @title FinancialOpportunity
 * @dev Interface for third parties to implement financial opportunities
 * for TrueReward with Assurance.
 */
interface FinancialOpportunity {
    /**
     * @dev deposits TrueUSD into finOP using transferFrom
     * @param _from account to transferFrom
     * @param _amount amount in TUSD to deposit to finOp
     * @return yTUSD minted from this deposit
     */
    function deposit(address _from, uint _amount) external returns(uint);
     /**
     * @dev Withdraw from finOp to _to account
     * @param _to account withdarw TUSD to
     * @param _amount amount in TUSD to withdraw from finOp
     * @return yTUSD amount deducted
     */
    function withdrawTo(address _to, uint _amount) external returns(uint);
    /**
     * @dev Withdraws all TUSD from finOp
     * @param _to account withdarw TUSD to
     * @return yTUSD amount deducted
     */
    function withdrawAll(address _to) external returns(uint);

    /**
     * Exchange rate between TUSD and yTUSD
     * @return TUSD / yTUSD price ratio
     */
    function perTokenValue() external view returns(uint);

    /**
     * Returns full balance of opportunity
     * @return yTUSD balance of opportunity
    **/
    function getBalance() external view returns (uint);
}

// File: contracts/TrueCurrencies/TrueRewardBackedToken.sol

pragma solidity ^0.5.13;



/**
 * @title TrueRewardBackedToken
 * @dev TrueRewardBackedToken is TrueUSD backed by debt.
 *
 * zTUSD represents an amount of TUSD owed to the zTUSD holder
 * zTUSD is calculated by calling perTokenValue on a financial opportunity
 * zTUSD is not transferrable in that the token itself is never tranferred
 * Rather, we override our transfer functions to account for user balances
 * We assume zTUSD always increases in value
 *
 * This contract uses a reserve holding of TUSD and zTUSD to save on gas costs
 * because calling the financial opportunity deposit() and withdraw() everytime
 * can be expensive.
 *
 * Currently, we only have a single financial opportunity.
 * We plan on upgrading this contract to support a multiple financial opportunity,
 * so some of the code is built to support this
 */
contract TrueRewardBackedToken is CompliantDepositTokenWithHook {

    /* Variables in Proxy Storage:
     * struct FinancialOpportunityAllocation { address financialOpportunity; uint proportion; }
     * mapping(address => FinancialOpportunityAllocation[]) _trueRewardDistribution;
     * mapping (address => mapping (address => uint256)) _financialOpportunityBalances;
    */

    // Reserve is an address which nobody has the private key to
    // Reserves of TUSD and TrueRewardBackedToken are held at this addess
    address public constant RESERVE = 0xf000000000000000000000000000000000000000;
    uint public _totalAaveSupply;
    address public aaveInterfaceAddress_;

    event TrueRewardEnabled(address _account);
    event TrueRewardDisabled(address _account);

    /** @dev return true if TrueReward is enabled for a given address */
    function trueRewardEnabled(address _address) public view returns (bool) {
        return _trueRewardDistribution[_address].length != 0;
    }

    /** @dev set new Aave Interface address */
    function setAaveInterfaceAddress(address _aaveInterfaceAddress) external onlyOwner {
        aaveInterfaceAddress_ = _aaveInterfaceAddress;
    }

    /** @dev return aave financial opportunity address */
    function aaveInterfaceAddress() public view returns (address) {
        return aaveInterfaceAddress_;
    }

    /** @dev get total aave supply in yTUSD */
    function totalAaveSupply() public view returns(uint) {
        return _totalAaveSupply;
    }

    /** @dev get zTUSD reserve balance */
    function zTUSDReserveBalance() public view returns (uint) {
        return _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()];
    }

    /**
     * @dev get total zTUSD balance of a given account
     * this only works for a single opportunity
     */
    function accountTotalLoanBackedBalance(address _account) public view returns (uint) {
        return _financialOpportunityBalances[_account][aaveInterfaceAddress()];
    }

    /*
     * @dev calculate rewards earned since last deposit
     */
    function rewardBalanceOf(address _account) public view returns (uint) {
        uint loanBackedBalance = accountTotalLoanBackedBalance(_account);
        return _zTUSDToTUSD(loanBackedBalance) - loanBackedBalance;
    }

    /**
     * @dev Get total supply of all TUSD backed by debt.
     * This amount includes accrued rewards.
     */
    function totalSupply() public view returns (uint256) {
        if (totalAaveSupply() != 0) {
            uint aaveSupply = _zTUSDToTUSD(totalAaveSupply());
            return totalSupply_.add(aaveSupply);
        }
        return super.totalSupply();
    }

    /**
     * @dev Get balance of TUSD including rewards for an address
     */
    function balanceOf(address _who) public view returns (uint256) {
        if (trueRewardEnabled(_who)) {
            return _zTUSDToTUSD(accountTotalLoanBackedBalance(_who));
        }
        return super.balanceOf(_who);
    }

    /**
     * @dev Utility to convert TUSD value to zTUSD value
     * zTUSD is TUSD backed by TrueRewards debt
     */
    function _TUSDToZTUSD(uint _amount) internal view returns (uint) {
        uint ratio = FinancialOpportunity(aaveInterfaceAddress()).perTokenValue();
        return _amount.mul(10 ** 18).div(ratio);
    }

    /**
     * @dev Utility to convert zTUSD value to TUSD value
     * zTUSD is TUSD backed by TrueRewards debt
     */
    function _zTUSDToTUSD(uint _amount) internal view returns (uint) {
        uint ratio = FinancialOpportunity(aaveInterfaceAddress()).perTokenValue();
        return ratio.mul(_amount).div(10 ** 18);
    }

    /**
     * @dev Withdraw all TrueCurrencies from reserve
     */
    function drainTrueCurrencyReserve(address _to, uint _value) external onlyOwner {
        _transferAllArgs(RESERVE, _to, _value);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is too much money in an opportunity and we want
     * to get more TrueCurrency.
     * This allows us to reduct the cost of transfers 5-10x in/out of opportunities
     */
    function convertToTrueCurrencyReserve(uint _value) external onlyOwner {
        uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(RESERVE, _value);
        _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
        // reentrancy

        _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()]
            .sub(zTUSDAmount);

        emit Transfer(RESERVE, address(0), _value);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is not enough money in an opportunity and we want
     * to get more Opportunity tokens
     * This allows us to reduct the cost of transfers 5-10x in/out of opportunities
     */
    function convertToZTUSDReserve(uint _value) external onlyOwner {
        uint balance = _getBalance(RESERVE);
        if (balance < _value) {
            return;
        }
        _setAllowance(RESERVE, aaveInterfaceAddress(), _value);
        uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(RESERVE, _value);
        _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);

        _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()]
            .add(zTUSDAmount);

        emit Transfer(address(0), RESERVE, _value);
    }

    /**
     * @dev enable Aave financial opportunity
     * Set allocation to 100% since we only have a single opportunity
     */
    function _enableAave() internal {
        require(_trueRewardDistribution[msg.sender].length == 0, "already enabled");
        _trueRewardDistribution[msg.sender].push(FinancialOpportunityAllocation(aaveInterfaceAddress(), 100));
    }

    /**
     * @dev disable Aave financial opportunity
     * Set allocation to 0% since we only have a single opportunity
     */
    function _disableAave() internal {
        delete _trueRewardDistribution[msg.sender][0];
        _trueRewardDistribution[msg.sender].length--;
    }

    /**
     * @dev Enable TrueReward and deposit user balance into opportunity.
     */
    function enableTrueReward() external {
        require(!trueRewardEnabled(msg.sender), "not turned on");
        uint balance = _getBalance(msg.sender);
        if (balance == 0) {
            _enableAave();
            return;
        }
        approve(aaveInterfaceAddress(), balance);
        uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(msg.sender, balance);
        _enableAave();
        _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
        _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()] = _financialOpportunityBalances
            [msg.sender][aaveInterfaceAddress()].add(zTUSDAmount);
        emit TrueRewardEnabled(msg.sender);
        emit Transfer(address(0), msg.sender, balance); //confirm that this amount is right
    }

    /**
     * @dev Disable TrueReward and withdraw user balance from opportunity.
     */
    function disableTrueReward() external {
        require(trueRewardEnabled(msg.sender), "already disabled");
        _disableAave();
        uint availableTUSDBalance = balanceOf(msg.sender);
        uint zTUSDWithdrawn = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(msg.sender, availableTUSDBalance);
        _totalAaveSupply = _totalAaveSupply.sub(_financialOpportunityBalances[msg.sender][aaveInterfaceAddress()]);
        _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()] = 0;
        emit TrueRewardDisabled(msg.sender);
        emit Transfer(msg.sender, address(0), zTUSDWithdrawn); // This is the last part that might not work
    }

    /**
     * @dev Transfer helper function for TrueRewardBackedToken
     * Uses reserve float to save gas costs for transactions with value < reserve balance.
     * Case #2 and #3 use reserve balances.
     *
     * There are 6 transfer cases
     *  1. Both sender and reciever are disabled
     *  2. Sender enabled, reciever disabled, value < reserve TUSD balance
     *  3. Sender disabled, reciever enabled, value < reserve zTUSD balance (in TUSD)
     *  4. Both sender and reciever are enabled
     *  5. Sender enabled, reciever disabled, value > reserve TUSD balance
     *  6. Sender disabled, reciever enabled, value > reserve zTUSD balance (in TUSD)
     *
     * When we upgrade to support multiple opportunities, here we also want to check
     * If the transfer is between the same opportunities.
     */
    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        // 1. Both sender and reciever are disabled
        // Exchange is in TUSD -> call the normal transfer function
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            super._transferAllArgs(_from, _to, _value);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");

        // calculate zTUSD balance
        uint valueInZTUSD = _TUSDToZTUSD(_value);

        // 2. Sender enabled, reciever disabled, value < reserve TUSD balance
        // Use reserve balance to transfer so we can save gas
        if (senderTrueRewardEnabled && !receiverTrueRewardEnabled && _value < _getBalance(RESERVE)) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            // use reserve to withdraw from financial opportunity reserve and transfer TUSD to reciever
            _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()].add(valueInZTUSD);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(valueInZTUSD);
            _subBalance(RESERVE, _value);
            _addBalance(finalTo, _value);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        }
        // 3. Sender disabled, reciever enabled, value < reserve zTUSD balance (in TUSD)
        // Use reserve balance to transfer so we can save gas
        else if (!senderTrueRewardEnabled && receiverTrueRewardEnabled && _value < _zTUSDToTUSD(zTUSDReserveBalance())) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _subBalance(_from, _value);
            _addBalance(RESERVE, _value);
            _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()].sub(valueInZTUSD);
            _financialOpportunityBalances[finalTo][aaveInterfaceAddress()] = _financialOpportunityBalances[finalTo][aaveInterfaceAddress()].add(valueInZTUSD);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        }
        // 4. Sender and reciever are enabled
        // Here we simply transfer zTUSD from the sender to the reciever
        else if (senderTrueRewardEnabled && receiverTrueRewardEnabled) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(valueInZTUSD);
            _financialOpportunityBalances[finalTo][aaveInterfaceAddress()] = _financialOpportunityBalances[finalTo][aaveInterfaceAddress()].add(valueInZTUSD);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        }
        // 5. Sender enabled, reciever disabled, value > reserve TUSD balance
        // Withdraw TUSD from opportunity, send to reciever, and burn zTUSD
        else if (senderTrueRewardEnabled) {
            emit Transfer(_from, address(this), _value); // transfer value to this contract
            emit Transfer(address(this), address(0), _value); // burn value
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress())
                .withdrawTo(_to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
            // watchout for reentrancy
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(zTUSDAmount);
        }
        // 6. Sender disabled, reciever enabled, value > reserve zTUSD balance (in TUSD)
        // Deposit TUSD into opportunity, mint zTUSD, and increase reciever zTUSD balance
        else if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            _setAllowance(_from, aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress())
                .deposit(_from, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), address(this), _value); // mint value
            emit Transfer(address(this), _to, _value); // send value to reciever
        }
    }

    /**
     * @dev TransferFromAll helper function for TrueRewardBackedToken
     * Uses reserve float to save gas costs for transactions with value < reserve balance.
     * Case #2 and #3 use reserve balances.
     *
     * There are 6 transfer cases
     *  1. Both sender and reciever are disabled
     *  2. Sender enabled, reciever disabled, value < reserve TUSD balance
     *  3. Sender disabled, reciever enabled, value < reserve zTUSD balance (in TUSD)
     *  4. Both sender and reciever are enabled
     *  5. Sender enabled, reciever disabled, value > reserve TUSD balance
     *  6. Sender disabled, reciever enabled, value > reserve zTUSD balance (in TUSD)
     *
     * When we upgrade to support multiple opportunities, here we also want to check
     * If the transfer is between the same opportunities.
     */
    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        // 1. Both sender and reciever are disabled -> normal transfer
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            super._transferFromAllArgs(_from, _to, _value, _spender);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");
        // calculate zTUSD value
        uint valueInZTUSD = _TUSDToZTUSD(_value);

        // 2. Sender enabled, reciever disabled, value < reserve TUSD balance
        if (senderTrueRewardEnabled && !receiverTrueRewardEnabled && _value < _getBalance(RESERVE)) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()].add(valueInZTUSD);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(valueInZTUSD);
            _subBalance(RESERVE, _value);
            _addBalance(finalTo, _value);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        }
        // 3. Sender disabled, reciever enabled, value < reserve zTUSD balance (in TUSD)
        else if (!senderTrueRewardEnabled && receiverTrueRewardEnabled && _value < _zTUSDToTUSD(zTUSDReserveBalance())) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _subBalance(_from, _value);
            _addBalance(RESERVE, _value);
            _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()].sub(valueInZTUSD);
            _financialOpportunityBalances[finalTo][aaveInterfaceAddress()] = _financialOpportunityBalances[finalTo][aaveInterfaceAddress()].add(valueInZTUSD);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        }
        // 4. Both sender and reciever are enabled
        else if (senderTrueRewardEnabled && receiverTrueRewardEnabled) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(valueInZTUSD);
            _financialOpportunityBalances[finalTo][aaveInterfaceAddress()] = _financialOpportunityBalances[finalTo][aaveInterfaceAddress()].add(valueInZTUSD);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        }
        // 5. Sender enabled, reciever disabled, value > reserve TUSD balance
        else if (senderTrueRewardEnabled) {
            emit Transfer(_from, address(this), _value);
            emit Transfer(address(this), address(0), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(_to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
            // watchout for reentrancy
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(zTUSDAmount);
        }
        // 6. Sender disabled, reciever enabled, value > reserve zTUSD balance (in TUSD)
        else if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            _setAllowance(_from, aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_from, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value); // // mint value
            emit Transfer(address(this), _to, _value); // send value to reciever
        }
    }

    /**
     * @dev mint function for TrueRewardBackedToken
     * Mints TrueUSD backed by debt
     * When we add multiple opportunities, this needs to work for mutliple interfaces
     */
    function mint(address _to, uint256 _value) public onlyOwner {
        super.mint(_to, _value);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (receiverTrueRewardEnabled) {
            approve(aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_to, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value);
        }
    }
}

// File: contracts/TrueCurrencies/DelegateERC20.sol

pragma solidity ^0.5.13;


/** @title DelegateERC20
Accept forwarding delegation calls from the old TrueUSD (V1) contract. This way the all the ERC20
functions in the old contract still works (except Burn).
*/
contract DelegateERC20 is CompliantDepositTokenWithHook {

    address constant DELEGATE_FROM = 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E;

    modifier onlyDelegateFrom() {
        require(msg.sender == DELEGATE_FROM);
        _;
    }

    function delegateTotalSupply() public view returns (uint256) {
        return totalSupply();
    }

    function delegateBalanceOf(address who) public view returns (uint256) {
        return _getBalance(who);
    }

    function delegateTransfer(address to, uint256 value, address origSender) public onlyDelegateFrom returns (bool) {
        _transferAllArgs(origSender, to, value);
        return true;
    }

    function delegateAllowance(address owner, address spender) public view returns (uint256) {
        return _getAllowance(owner, spender);
    }

    function delegateTransferFrom(address from, address to, uint256 value, address origSender) public onlyDelegateFrom returns (bool) {
        _transferFromAllArgs(from, to, value, origSender);
        return true;
    }

    function delegateApprove(address spender, uint256 value, address origSender) public onlyDelegateFrom returns (bool) {
        _approveAllArgs(spender, value, origSender);
        return true;
    }

    function delegateIncreaseApproval(address spender, uint addedValue, address origSender) public onlyDelegateFrom returns (bool) {
        _increaseAllowanceAllArgs(spender, addedValue, origSender);
        return true;
    }

    function delegateDecreaseApproval(address spender, uint subtractedValue, address origSender) public onlyDelegateFrom returns (bool) {
        _decreaseAllowanceAllArgs(spender, subtractedValue, origSender);
        return true;
    }
}

// File: contracts/TrueCurrencies/TrueUSD.sol

pragma solidity ^0.5.13;





/** @title TrueUSD
 * @dev This is the top-level ERC20 contract, but most of the interesting functionality is
 * inherited - see the documentation on the corresponding contracts.
 */
contract TrueUSD is TrueRewardBackedToken, DelegateERC20 {
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure returns (string memory) {
        return "TrueUSD";
    }

    function symbol() public pure returns (string memory) {
        return "TUSD";
    }

    function canBurn() internal pure returns (bytes32) {
        return "canBurn";
    }

    // used by proxy to initalize
    // must create proxy and initalize in same transaction
    // this sets the owner to msg.sender
    // may be a security risk for deployment
    function initialize() external {
        require(!initialized, "already initialized");
        initialized = true;
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }
}

// File: contracts/TrueCurrencies/utilities/TokenFaucet.sol

pragma solidity^0.5.13;



contract TokenFaucet {
    struct MintOperation {
        address to;
        uint256 value;
        uint256 requestedBlock;
        uint256 numberOfApproval;
        bool paused;
        mapping(address => bool) approved;
    }

    // same storage as TokenController
    address public owner;
    address public pendingOwner;

    bool initialized;
    uint256 public instantMintThreshold;
    uint256 public ratifiedMintThreshold;
    uint256 public multiSigMintThreshold;

    uint256 public instantMintLimit;
    uint256 public ratifiedMintLimit;
    uint256 public multiSigMintLimit;

    uint256 public instantMintPool;
    uint256 public ratifiedMintPool;
    uint256 public multiSigMintPool;
    address[2] public ratifiedPoolRefillApprovals;

    bool public mintPaused;
    uint256 public mintReqInvalidBeforeThisBlock; //all mint request before this block are invalid
    address public mintKey;
    MintOperation[] public mintOperations; //list of a mint requests

    TrueUSD public token;

    Registry public registry;

    event SetToken(TrueUSD newContract);
    event SetRegistry(Registry indexed registry);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event NewOwnerPending(address indexed currentOwner, address indexed pendingOwner);
    event TransferChild(HasOwner indexed child, address indexed newOwner);
    event MintThresholdChanged(uint instant, uint ratified, uint multiSig);
    event InstantMint(address indexed to, uint256 indexed value, address indexed mintKey);

    function initialize() public {
        require(initialized!=true, "already initalized");
        owner = msg.sender;
        initialized = true;
        emit OwnershipTransferred(address(0), owner);
    }

    function faucet(uint256 _amount) external {
        registry.setAttributeValue(msg.sender, 0x6861735061737365644b59432f414d4c00000000000000000000000000000000, 1);
        require(_amount <= instantMintThreshold);
        token.mint(msg.sender, _amount);
        emit InstantMint(msg.sender, _amount, msg.sender);
    }

    function setMintThresholds(uint256 _instant, uint256 _ratified, uint256 _multiSig) external onlyOwner {
        require(_instant <= _ratified && _ratified <= _multiSig);
        instantMintThreshold = _instant;
        ratifiedMintThreshold = _ratified;
        multiSigMintThreshold = _multiSig;
        emit MintThresholdChanged(_instant, _ratified, _multiSig);
    }


    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "only Owner");
        _;
    }

    /**
    * @dev Modifier throws if called by any account other than the pendingOwner.
    */
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner);
        _;
    }

    /**
    * @dev Allows the current owner to set the pendingOwner address.
    * @param newOwner The address to transfer ownership to.
    */
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit NewOwnerPending(owner, pendingOwner);
    }

    /**
    * @dev Allows the pendingOwner address to finalize the transfer.
    */
    function claimOwnership() external onlyPendingOwner {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /**
    *@dev Claim ownership of an arbitrary HasOwner contract
    */
    function issueClaimOwnership(address _other) public onlyOwner {
        HasOwner other = HasOwner(_other);
        other.claimOwnership();
    }

    /**
    *@dev Transfer ownership of _child to _newOwner.
    Can be used e.g. to upgrade this TokenController contract.
    *@param _child contract that tokenController currently Owns
    *@param _newOwner new owner/pending owner of _child
    */
    function transferChild(HasOwner _child, address _newOwner) external onlyOwner {
        _child.transferOwnership(_newOwner);
        emit TransferChild(_child, _newOwner);
    }

    /**
    *@dev Update this contract's token pointer to newContract (e.g. if the
    contract is upgraded)
    */
    function setToken(TrueUSD _newContract) external onlyOwner {
        token = _newContract;
        emit SetToken(_newContract);
    }

    /**
    *@dev Swap out token's permissions registry
    *@param _registry new registry for token
    */
    function setTokenRegistry(Registry _registry) external onlyOwner {
        token.setRegistry(_registry);
    }

    /**
    *@dev Update this contract's registry pointer to _registry
    */
    function setRegistry(Registry _registry) external onlyOwner {
        registry = _registry;
        emit SetRegistry(registry);
    }

    /**
     * @dev Sets the contract which has permissions to manage truerewards reserve
     * Controls access to reserve functions to allow providing liquidity
     */
    function setAaveInterfaceAddress(address _aaveInterfaceAddress) external onlyOwner {
        token.setAaveInterfaceAddress(_aaveInterfaceAddress);
    }


}
