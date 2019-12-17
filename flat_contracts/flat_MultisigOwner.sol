pragma solidity ^0.5.13;

// File: openzeppelin-solidity/contracts/math/SafeMath.sol

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

// File: openzeppelin-solidity/contracts/token/ERC20/IERC20.sol

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

// File: registry/contracts/Registry.sol

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

// File: contracts/modularERC20/Ownable.sol

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract Ownable {
  address public owner;


  event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);


  /**
   * @dev The Ownable constructor sets the original `owner` of the contract to the sender
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

// File: contracts/modularERC20/Claimable.sol

/**
 * @title Claimable
 * @dev Extension for the Ownable contract, where the ownership needs to be claimed.
 * This allows the new owner to accept the transfer.
 */
contract Claimable is Ownable {
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
  function transferOwnership(address newOwner) onlyOwner public {
    pendingOwner = newOwner;
  }

  /**
   * @dev Allows the pendingOwner address to finalize the transfer.
   */
  function claimOwnership() onlyPendingOwner public {
    emit OwnershipTransferred(owner, pendingOwner);
    owner = pendingOwner;
    pendingOwner = address(0);
  }
}

// File: contracts/modularERC20/BalanceSheet.sol

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

// File: contracts/modularERC20/AllowanceSheet.sol

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

// File: contracts/ProxyStorage.sol

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

// File: contracts/HasOwner.sol

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

// File: contracts/TrueCoinReceiver.sol

contract TrueCoinReceiver {
    function tokenFallback( address from, uint256 value ) external;
}

// File: contracts/ReclaimerToken.sol

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
    function reclaimContract(Ownable _ownable) external onlyOwner {
        _ownable.transferOwnership(owner);
    }

}

// File: contracts/modularERC20/ModularBasicToken.sol

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

// File: contracts/modularERC20/ModularStandardToken.sol

/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic standard token.
 * @dev https://github.com/ethereum/EIPs/issues/20
 * @dev Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract ModularStandardToken is ModularBasicToken {
    using SafeMath for uint256;
    
    event Approval(address indexed owner, address indexed spender, uint256 value);

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

    function _approveAllArgs(address _spender, uint256 _value, address _tokenHolder) internal {
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
    function increaseAllowance(address _spender, uint _addedValue) public returns (bool) {
        _increaseAllowanceAllArgs(_spender, _addedValue, msg.sender);
        return true;
    }

    function _increaseAllowanceAllArgs(address _spender, uint256 _addedValue, address _tokenHolder) internal {
        _addAllowance(_tokenHolder, _spender, _addedValue);
        emit Approval(_tokenHolder, _spender, _getAllowance(_tokenHolder, _spender));
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
    function decreaseAllowance(address _spender, uint _subtractedValue) public returns (bool) {
        _decreaseAllowanceAllArgs(_spender, _subtractedValue, msg.sender);
        return true;
    }

    function _decreaseAllowanceAllArgs(address _spender, uint256 _subtractedValue, address _tokenHolder) internal {
        uint256 oldValue = _getAllowance(_tokenHolder, _spender);
        uint256 newValue;
        if (_subtractedValue > oldValue) {
            newValue = 0;
        } else {
            newValue = oldValue - _subtractedValue;
        }
        _setAllowance(_tokenHolder, _spender, newValue);
        emit Approval(_tokenHolder,_spender, newValue);
    }

    function allowance(address _who, address _spender) public view returns (uint256) {
        return _getAllowance(_who, _spender);
    }

    function _getAllowance(address _who, address _spender) internal view returns (uint256 value) {
        return _allowance[_who][_spender];
    }

    function _addAllowance(address _who, address _spender, uint256 _value) internal {
        _allowance[_who][_spender] = _allowance[_who][_spender].add(_value);
    }

    function _subAllowance(address _who, address _spender, uint256 _value) internal returns (uint256 newAllowance){
        newAllowance = _allowance[_who][_spender].sub(_value);
        if (newAllowance < INFINITE_ALLOWANCE) {
            _allowance[_who][_spender] = newAllowance;
        }
    }

    function _setAllowance(address _who, address _spender, uint256 _value) internal {
        _allowance[_who][_spender] = _value;
    }
}

// File: contracts/modularERC20/ModularBurnableToken.sol

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

// File: contracts/BurnableTokenWithBounds.sol

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

// File: contracts/GasRefundToken.sol

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

// File: contracts/CompliantDepositTokenWithHook.sol

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
            if (0 == _subAllowance(_from, _spender, _value)) {
                // no refund
            } else {
                gasRefund15();
            }
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
                    if (0 == _subBalance(_from, _value)) {
                        // do not refund
                    } else {
                        gasRefund30();
                    }
                } else {
                    if (0 == _subBalance(_from, _value)) {
                        gasRefund30();
                    } else {
                        gasRefund39();
                    }
                }
            } else {
                if (0 == _subAllowance(_from, _spender, _value)) {
                    if (0 == _subBalance(_from, _value)) {
                        // do not refund
                    } else {
                        gasRefund15();
                    }
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
                } else {
                    // do not refund
                }
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

// File: contracts/Proxy/OwnedUpgradeabilityProxy.sol

/**
 * @title OwnedUpgradeabilityProxy
 * @dev This contract combines an upgradeability proxy with basic authorization control functionalities
 */
contract OwnedUpgradeabilityProxy {
    /**
    * @dev Event to show ownership has been transferred
    * @param previousOwner representing the address of the previous owner
    * @param newOwner representing the address of the new owner
    */
    event ProxyOwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
    * @dev Event to show ownership transfer is pending
    * @param currentOwner representing the address of the current owner
    * @param pendingOwner representing the address of the pending owner
    */
    event NewPendingOwner(address currentOwner, address pendingOwner);
    
    // Storage position of the owner and pendingOwner of the contract
    bytes32 private constant proxyOwnerPosition = 0x6279e8199720cf3557ecd8b58d667c8edc486bd1cf3ad59ea9ebdfcae0d0dfac;//keccak256("trueUSD.proxy.owner");
    bytes32 private constant pendingProxyOwnerPosition = 0x8ddbac328deee8d986ec3a7b933a196f96986cb4ee030d86cc56431c728b83f4;//keccak256("trueUSD.pending.proxy.owner");

    /**
    * @dev the constructor sets the original owner of the contract to the sender account.
    */
    constructor() public {
        _setUpgradeabilityOwner(msg.sender);
    }

    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyProxyOwner() {
        require(msg.sender == proxyOwner(), "only Proxy Owner");
        _;
    }

    /**
    * @dev Throws if called by any account other than the pending owner.
    */
    modifier onlyPendingProxyOwner() {
        require(msg.sender == pendingProxyOwner(), "only pending Proxy Owner");
        _;
    }

    /**
    * @dev Tells the address of the owner
    * @return the address of the owner
    */
    function proxyOwner() public view returns (address owner) {
        bytes32 position = proxyOwnerPosition;
        assembly {
            owner := sload(position)
        }
    }

    /**
    * @dev Tells the address of the owner
    * @return the address of the owner
    */
    function pendingProxyOwner() public view returns (address pendingOwner) {
        bytes32 position = pendingProxyOwnerPosition;
        assembly {
            pendingOwner := sload(position)
        }
    }

    /**
    * @dev Sets the address of the owner
    */
    function _setUpgradeabilityOwner(address newProxyOwner) internal {
        bytes32 position = proxyOwnerPosition;
        assembly {
            sstore(position, newProxyOwner)
        }
    }

    /**
    * @dev Sets the address of the owner
    */
    function _setPendingUpgradeabilityOwner(address newPendingProxyOwner) internal {
        bytes32 position = pendingProxyOwnerPosition;
        assembly {
            sstore(position, newPendingProxyOwner)
        }
    }

    /**
    * @dev Allows the current owner to transfer control of the contract to a newOwner.
    *changes the pending owner to newOwner. But doesn't actually transfer
    * @param newOwner The address to transfer ownership to.
    */
    function transferProxyOwnership(address newOwner) external onlyProxyOwner {
        require(newOwner != address(0));
        _setPendingUpgradeabilityOwner(newOwner);
        emit NewPendingOwner(proxyOwner(), newOwner);
    }

    /**
    * @dev Allows the pendingOwner to claim ownership of the proxy
    */
    function claimProxyOwnership() external onlyPendingProxyOwner {
        emit ProxyOwnershipTransferred(proxyOwner(), pendingProxyOwner());
        _setUpgradeabilityOwner(pendingProxyOwner());
        _setPendingUpgradeabilityOwner(address(0));
    }

    /**
    * @dev Allows the proxy owner to upgrade the current version of the proxy.
    * @param implementation representing the address of the new implementation to be set.
    */
    function upgradeTo(address implementation) external onlyProxyOwner {
        address currentImplementation;
        bytes32 position = implementationPosition;
        assembly {
            currentImplementation := sload(position)
        }
        require(currentImplementation != implementation);
        assembly {
          sstore(position, implementation)
        }
        emit Upgraded(implementation);
    }
    /**
    * @dev This event will be emitted every time the implementation gets upgraded
    * @param implementation representing the address of the upgraded implementation
    */
    event Upgraded(address indexed implementation);

    // Storage position of the address of the current implementation
    bytes32 private constant implementationPosition = 0x6e41e0fbe643dfdb6043698bf865aada82dc46b953f754a3468eaa272a362dc7; //keccak256("trueUSD.proxy.implementation");

    function implementation() public view returns (address impl) {
        bytes32 position = implementationPosition;
        assembly {
            impl := sload(position)
        }
    }

    /**
    * @dev Fallback function allowing to perform a delegatecall to the given implementation.
    * This function will return whatever the implementation call returns
    */
    function() external payable {
        bytes32 position = implementationPosition;
        
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, returndatasize, calldatasize)
            let result := delegatecall(gas, sload(position), ptr, calldatasize, returndatasize, returndatasize)
            returndatacopy(ptr, 0, returndatasize)

            switch result
            case 0 { revert(ptr, returndatasize) }
            default { return(ptr, returndatasize) }
        }
    }
}

// File: contracts/Admin/TokenController.sol

/** @title TokenController
@dev This contract allows us to split ownership of the TrueUSD contract
into two addresses. One, called the "owner" address, has unfettered control of the TrueUSD contract -
it can mint new tokens, transfer ownership of the contract, etc. However to make
extra sure that TrueUSD is never compromised, this owner key will not be used in
day-to-day operations, allowing it to be stored at a heightened level of security.
Instead, the owner appoints an various "admin" address. 
There are 3 different types of admin addresses;  MintKey, MintRatifier, and MintPauser. 
MintKey can request and revoke mints one at a time.
MintPausers can pause individual mints or pause all mints.
MintRatifiers can approve and finalize mints with enough approval.

There are three levels of mints: instant mint, ratified mint, and multiSig mint. Each have a different threshold
and deduct from a different pool.
Instant mint has the lowest threshold and finalizes instantly without any ratifiers. Deduct from instant mint pool,
which can be refilled by one ratifier.
Ratify mint has the second lowest threshold and finalizes with one ratifier approval. Deduct from ratify mint pool,
which can be refilled by three ratifiers.
MultiSig mint has the highest threshold and finalizes with three ratifier approvals. Deduct from multiSig mint pool,
which can only be refilled by the owner.
*/

contract TokenController {
    using SafeMath for uint256;

    struct MintOperation {
        address to;
        uint256 value;
        uint256 requestedBlock;
        uint256 numberOfApproval;
        bool paused;
        mapping(address => bool) approved; 
    }

    address payable public owner;
    address payable public pendingOwner;

    bool public initialized;

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

    uint8 constant public RATIFY_MINT_SIGS = 1; //number of approvals needed to finalize a Ratified Mint
    uint8 constant public MULTISIG_MINT_SIGS = 3; //number of approvals needed to finalize a MultiSig Mint

    bool public mintPaused;
    uint256 public mintReqInvalidBeforeThisBlock; //all mint request before this block are invalid
    address public mintKey;
    MintOperation[] public mintOperations; //list of a mint requests
    
    CompliantDepositTokenWithHook public token;
    Registry public registry;
    address public fastPause;

    bytes32 constant public IS_MINT_PAUSER = "isTUSDMintPausers";
    bytes32 constant public IS_MINT_RATIFIER = "isTUSDMintRatifier";
    bytes32 constant public IS_REDEMPTION_ADMIN = "isTUSDRedemptionAdmin";

    address constant public PAUSED_IMPLEMENTATION = address(1); // ***To be changed the paused version of TrueUSD in Production

    modifier onlyFastPauseOrOwner() {
        require(msg.sender == fastPause || msg.sender == owner, "must be pauser or owner");
        _;
    }

    modifier onlyMintKeyOrOwner() {
        require(msg.sender == mintKey || msg.sender == owner, "must be mintKey or owner");
        _;
    }

    modifier onlyMintPauserOrOwner() {
        require(registry.hasAttribute(msg.sender, IS_MINT_PAUSER) || msg.sender == owner, "must be pauser or owner");
        _;
    }

    modifier onlyMintRatifierOrOwner() {
        require(registry.hasAttribute(msg.sender, IS_MINT_RATIFIER) || msg.sender == owner, "must be ratifier or owner");
        _;
    }

    modifier onlyOwnerOrRedemptionAdmin() {
        require(registry.hasAttribute(msg.sender, IS_REDEMPTION_ADMIN) || msg.sender == owner, "must be Redemption admin or owner");
        _;
    }

    //mint operations by the mintkey cannot be processed on when mints are paused
    modifier mintNotPaused() {
        if (msg.sender != owner) {
            require(!mintPaused, "minting is paused");
        }
        _;
    }
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event NewOwnerPending(address indexed currentOwner, address indexed pendingOwner);
    event SetRegistry(address indexed registry);
    event TransferChild(address indexed child, address indexed newOwner);
    event RequestReclaimContract(address indexed other);
    event SetToken(CompliantDepositTokenWithHook newContract);
    
    event RequestMint(address indexed to, uint256 indexed value, uint256 opIndex, address mintKey);
    event FinalizeMint(address indexed to, uint256 indexed value, uint256 opIndex, address mintKey);
    event InstantMint(address indexed to, uint256 indexed value, address indexed mintKey);
    
    event TransferMintKey(address indexed previousMintKey, address indexed newMintKey);
    event MintRatified(uint256 indexed opIndex, address indexed ratifier);
    event RevokeMint(uint256 opIndex);
    event AllMintsPaused(bool status);
    event MintPaused(uint opIndex, bool status);
    event MintApproved(address approver, uint opIndex);
    event FastPauseSet(address _newFastPause);

    event MintThresholdChanged(uint instant, uint ratified, uint multiSig);
    event MintLimitsChanged(uint instant, uint ratified, uint multiSig);
    event InstantPoolRefilled();
    event RatifyPoolRefilled();
    event MultiSigPoolRefilled();

    /*
    ========================================
    Ownership functions
    ========================================
    */

    function initialize() external {
        require(!initialized, "already initialized");
        owner = msg.sender;
        initialized = true;
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
    function transferOwnership(address payable newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit NewOwnerPending(address(owner), address(pendingOwner));
    }

    /**
    * @dev Allows the pendingOwner address to finalize the transfer.
    */
    function claimOwnership() external onlyPendingOwner {
        emit OwnershipTransferred(address(owner), address(pendingOwner));
        owner = pendingOwner;
        pendingOwner = address(0);
    }
    
    /*
    ========================================
    proxy functions
    ========================================
    */

    function transferTusdProxyOwnership(address _newOwner) external onlyOwner {
        OwnedUpgradeabilityProxy(address(uint160(address(token)))).transferProxyOwnership(_newOwner);
    }

    function claimTusdProxyOwnership() external onlyOwner {
        OwnedUpgradeabilityProxy(address(uint160(address(token)))).claimProxyOwnership();
    }

    function upgradeTusdProxyImplTo(address _implementation) external onlyOwner {
        OwnedUpgradeabilityProxy(address(uint160(address(token)))).upgradeTo(_implementation);
    }

    /*
    ========================================
    Minting functions
    ========================================
    */

    /**
     * @dev set the threshold for a mint to be considered an instant mint, ratify mint and multiSig mint
     Instant mint requires no approval, ratify mint requires 1 approval and multiSig mint requires 3 approvals
     */
    function setMintThresholds(uint256 _instant, uint256 _ratified, uint256 _multiSig) external onlyOwner {
        require(_instant <= _ratified && _ratified <= _multiSig);
        instantMintThreshold = _instant;
        ratifiedMintThreshold = _ratified;
        multiSigMintThreshold = _multiSig;
        emit MintThresholdChanged(_instant, _ratified, _multiSig);
    }


    /**
     * @dev set the limit of each mint pool. For example can only instant mint up to the instant mint pool limit
     before needing to refill
     */
    function setMintLimits(uint256 _instant, uint256 _ratified, uint256 _multiSig) external onlyOwner {
        require(_instant <= _ratified && _ratified <= _multiSig);
        instantMintLimit = _instant;
        if (instantMintPool > instantMintLimit) {
            instantMintPool = instantMintLimit;
        }
        ratifiedMintLimit = _ratified;
        if (ratifiedMintPool > ratifiedMintLimit) {
            ratifiedMintPool = ratifiedMintLimit;
        }
        multiSigMintLimit = _multiSig;
        if (multiSigMintPool > multiSigMintLimit) {
            multiSigMintPool = multiSigMintLimit;
        }
        emit MintLimitsChanged(_instant, _ratified, _multiSig);
    }

    /**
     * @dev Ratifier can refill instant mint pool
     */
    function refillInstantMintPool() external onlyMintRatifierOrOwner {
        ratifiedMintPool = ratifiedMintPool.sub(instantMintLimit.sub(instantMintPool));
        instantMintPool = instantMintLimit;
        emit InstantPoolRefilled();
    }

    /**
     * @dev Owner or 3 ratifiers can refill Ratified Mint Pool
     */
    function refillRatifiedMintPool() external onlyMintRatifierOrOwner {
        if (msg.sender != owner) {
            address[2] memory refillApprovals = ratifiedPoolRefillApprovals;
            require(msg.sender != refillApprovals[0] && msg.sender != refillApprovals[1]);
            if (refillApprovals[0] == address(0)) {
                ratifiedPoolRefillApprovals[0] = msg.sender;
                return;
            } 
            if (refillApprovals[1] == address(0)) {
                ratifiedPoolRefillApprovals[1] = msg.sender;
                return;
            } 
        }
        delete ratifiedPoolRefillApprovals; // clears the whole array
        multiSigMintPool = multiSigMintPool.sub(ratifiedMintLimit.sub(ratifiedMintPool));
        ratifiedMintPool = ratifiedMintLimit;
        emit RatifyPoolRefilled();
    }

    /**
     * @dev Owner can refill MultiSig Mint Pool
     */
    function refillMultiSigMintPool() external onlyOwner {
        multiSigMintPool = multiSigMintLimit;
        emit MultiSigPoolRefilled();
    }

    /**
     * @dev mintKey initiates a request to mint _value for account _to
     * @param _to the address to mint to
     * @param _value the amount requested
     */
    function requestMint(address _to, uint256 _value) external mintNotPaused onlyMintKeyOrOwner {
        MintOperation memory op = MintOperation(_to, _value, block.number, 0, false);
        emit RequestMint(_to, _value, mintOperations.length, msg.sender);
        mintOperations.push(op);
    }


    /**
     * @dev Instant mint without ratification if the amount is less than instantMintThreshold and instantMintPool
     * @param _to the address to mint to
     * @param _value the amount minted
     */
    function instantMint(address _to, uint256 _value) external mintNotPaused onlyMintKeyOrOwner {
        require(_value <= instantMintThreshold, "over the instant mint threshold");
        require(_value <= instantMintPool, "instant mint pool is dry");
        instantMintPool = instantMintPool.sub(_value);
        emit InstantMint(_to, _value, msg.sender);
        token.mint(_to, _value);
    }


    /**
     * @dev ratifier ratifies a request mint. If the number of ratifiers that signed off is greater than 
     the number of approvals required, the request is finalized
     * @param _index the index of the requestMint to ratify
     * @param _to the address to mint to
     * @param _value the amount requested
     */
    function ratifyMint(uint256 _index, address _to, uint256 _value) external mintNotPaused onlyMintRatifierOrOwner {
        MintOperation memory op = mintOperations[_index];
        require(op.to == _to, "to address does not match");
        require(op.value == _value, "amount does not match");
        require(!mintOperations[_index].approved[msg.sender], "already approved");
        mintOperations[_index].approved[msg.sender] = true;
        mintOperations[_index].numberOfApproval = mintOperations[_index].numberOfApproval.add(1);
        emit MintRatified(_index, msg.sender);
        if (hasEnoughApproval(mintOperations[_index].numberOfApproval, _value)){
            finalizeMint(_index);
        }
    }

    /**
     * @dev finalize a mint request, mint the amount requested to the specified address
     @param _index of the request (visible in the RequestMint event accompanying the original request)
     */
    function finalizeMint(uint256 _index) public mintNotPaused {
        MintOperation memory op = mintOperations[_index];
        address to = op.to;
        uint256 value = op.value;
        if (msg.sender != owner) {
            require(canFinalize(_index));
            _subtractFromMintPool(value);
        }
        delete mintOperations[_index];
        token.mint(to, value);
        emit FinalizeMint(to, value, _index, msg.sender);
    }

    /**
     * assumption: only invoked when canFinalize
     */
    function _subtractFromMintPool(uint256 _value) internal {
        if (_value <= ratifiedMintPool && _value <= ratifiedMintThreshold) {
            ratifiedMintPool = ratifiedMintPool.sub(_value);
        } else {
            multiSigMintPool = multiSigMintPool.sub(_value);
        }
    }

    /**
     * @dev compute if the number of approvals is enough for a given mint amount
     */
    function hasEnoughApproval(uint256 _numberOfApproval, uint256 _value) public view returns (bool) {
        if (_value <= ratifiedMintPool && _value <= ratifiedMintThreshold) {
            if (_numberOfApproval >= RATIFY_MINT_SIGS){
                return true;
            }
        }
        if (_value <= multiSigMintPool && _value <= multiSigMintThreshold) {
            if (_numberOfApproval >= MULTISIG_MINT_SIGS){
                return true;
            }
        }
        if (msg.sender == owner) {
            return true;
        }
        return false;
    }

    /**
     * @dev compute if a mint request meets all the requirements to be finalized
     utility function for a front end
     */
    function canFinalize(uint256 _index) public view returns(bool) {
        MintOperation memory op = mintOperations[_index];
        require(op.requestedBlock > mintReqInvalidBeforeThisBlock, "this mint is invalid"); //also checks if request still exists
        require(!op.paused, "this mint is paused");
        require(hasEnoughApproval(op.numberOfApproval, op.value), "not enough approvals");
        return true;
    }

    /** 
    *@dev revoke a mint request, Delete the mintOperation
    *@param index of the request (visible in the RequestMint event accompanying the original request)
    */
    function revokeMint(uint256 _index) external onlyMintKeyOrOwner {
        delete mintOperations[_index];
        emit RevokeMint(_index);
    }

    function mintOperationCount() public view returns (uint256) {
        return mintOperations.length;
    }

    /*
    ========================================
    Key management
    ========================================
    */

    /** 
    *@dev Replace the current mintkey with new mintkey 
    *@param _newMintKey address of the new mintKey
    */
    function transferMintKey(address _newMintKey) external onlyOwner {
        require(_newMintKey != address(0), "new mint key cannot be 0x0");
        emit TransferMintKey(mintKey, _newMintKey);
        mintKey = _newMintKey;
    }
 
    /*
    ========================================
    Mint Pausing
    ========================================
    */

    /** 
    *@dev invalidates all mint request initiated before the current block 
    */
    function invalidateAllPendingMints() external onlyOwner {
        mintReqInvalidBeforeThisBlock = block.number;
    }

    /** 
    *@dev pause any further mint request and mint finalizations 
    */
    function pauseMints() external onlyMintPauserOrOwner {
        mintPaused = true;
        emit AllMintsPaused(true);
    }

    /** 
    *@dev unpause any further mint request and mint finalizations 
    */
    function unpauseMints() external onlyOwner {
        mintPaused = false;
        emit AllMintsPaused(false);
    }

    /** 
    *@dev pause a specific mint request
    *@param  _opIndex the index of the mint request the caller wants to pause
    */
    function pauseMint(uint _opIndex) external onlyMintPauserOrOwner {
        mintOperations[_opIndex].paused = true;
        emit MintPaused(_opIndex, true);
    }

    /** 
    *@dev unpause a specific mint request
    *@param  _opIndex the index of the mint request the caller wants to unpause
    */
    function unpauseMint(uint _opIndex) external onlyOwner {
        mintOperations[_opIndex].paused = false;
        emit MintPaused(_opIndex, false);
    }

    /*
    ========================================
    set and claim contracts, administrative
    ========================================
    */


    /** 
    *@dev Update this contract's token pointer to newContract (e.g. if the
    contract is upgraded)
    */
    function setToken(CompliantDepositTokenWithHook _newContract) external onlyOwner {
        token = _newContract;
        emit SetToken(_newContract);
    }

    /** 
    *@dev Update this contract's registry pointer to _registry
    */
    function setRegistry(Registry _registry) external onlyOwner {
        registry = _registry;
        emit SetRegistry(address(registry));
    }

    /** 
    *@dev Swap out token's permissions registry
    *@param _registry new registry for token
    */
    function setTokenRegistry(Registry _registry) external onlyOwner {
        token.setRegistry(_registry);
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
        emit TransferChild(address(_child), _newOwner);
    }

    /** 
    *@dev Transfer ownership of a contract from token to this TokenController.
    Can be used e.g. to reclaim balance sheet
    in order to transfer it to an upgraded TrueUSD contract.
    *@param _other address of the contract to claim ownership of
    */
    function requestReclaimContract(Ownable _other) public onlyOwner {
        token.reclaimContract(_other);
        emit RequestReclaimContract(address(_other));
    }

    /** 
    *@dev send all ether in token address to the owner of tokenController 
    */
    function requestReclaimEther() external onlyOwner {
        token.reclaimEther(owner);
    }

    /** 
    *@dev transfer all tokens of a particular type in token address to the
    owner of tokenController 
    *@param _token token address of the token to transfer
    */
    function requestReclaimToken(IERC20 _token) external onlyOwner {
        token.reclaimToken(_token, owner);
    }

    /** 
    *@dev set new contract to which specified address can send eth to to quickly pause token
    *@param _newFastPause address of the new contract
    */
    function setFastPause(address _newFastPause) external onlyOwner {
        fastPause = _newFastPause;
        emit FastPauseSet(address(_newFastPause));
    }

    /** 
    *@dev pause all pausable actions on TrueUSD, mints/burn/transfer/approve
    */
    function pauseToken() external onlyFastPauseOrOwner {
        OwnedUpgradeabilityProxy(address(uint160(address(token)))).upgradeTo(PAUSED_IMPLEMENTATION);
    }
    
    /** 
    *@dev wipe balance of a blacklisted address
    *@param _blacklistedAddress address whose balance will be wiped
    */
    function wipeBlackListedTrueUSD(address _blacklistedAddress) external onlyOwner {
        token.wipeBlacklistedAccount(_blacklistedAddress);
    }

    /** 
    *@dev Change the minimum and maximum amounts that TrueUSD users can
    burn to newMin and newMax
    *@param _min minimum amount user can burn at a time
    *@param _max maximum amount user can burn at a time
    */
    function setBurnBounds(uint256 _min, uint256 _max) external onlyOwner {
        token.setBurnBounds(_min, _max);
    }

    /** 
    *@dev Owner can send ether balance in contract address
    *@param _to address to which the funds will be send to
    */
    function reclaimEther(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /** 
    *@dev Owner can send erc20 token balance in contract address
    *@param _token address of the token to send
    *@param _to address to which the funds will be send to
    */
    function reclaimToken(IERC20 _token, address _to) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        _token.transfer(_to, balance);
    }
}

// File: contracts/Admin/MultisigOwner.sol

/*
This contract is the owner of TokenController. 
This contract is responsible for calling all onlyOwner functions in
TokenController.
This contract has a copy of all functions in TokenController.
Functions with name starting with 'ms' are not in TokenController.
They are for admin purposes (eg. transfer eth out of MultiSigOwner)
MultiSigOwner contract has three owners
The first time a function is called, an action is created.
The action is in pending state until another owner approve the action.
Once another owner approves, the action will be executed immediately.
There can only be one pending/in flight action at a time. 
To approve an action the owner needs to call the same function with the
same parameter. If the function or parameter doesn't match the current in
flight action, it is reverted. 
Each owner can only approve/veto the current action once.
Vetoing an in flight also requires 2/3 owners to veto.
*/
contract MultiSigOwner {

    mapping (address => bool) public owners;

    //mapping that keeps track of which owner had already voted in the current action
    mapping(address=>bool) public voted;

    //The controller instance that this multisig controls
    TokenController public tokenController;

    //list of all owners of the multisigOwner
    address[3] public ownerList;


    bool public initialized;

    //current owner action
    OwnerAction public ownerAction;

    modifier onlyOwner() {
        require(owners[msg.sender], "only Owner");
        _;
    }

    struct OwnerAction {
        bytes callData;
        string actionName;
        uint8 approveSigs;
        uint8 disappoveSigs;
    }

    event ActionInitiated(string actionName);
    event ActionExecuted(string actionName);
    event ActionVetoed(string actionName);


    //Initial Owners are set during deployment
    function msInitialize(address[3] calldata _initialOwners) external {
        require(!initialized);
        require(_initialOwners[0] != address(0) &&
        _initialOwners[1] != address(0) &&
        _initialOwners[2] != address(0));
        owners[_initialOwners[0]] = true;
        owners[_initialOwners[1]] = true;
        owners[_initialOwners[2]] = true;
        ownerList[0] = _initialOwners[0];
        ownerList[1] = _initialOwners[1];
        ownerList[2] = _initialOwners[2];
        initialized = true;
    }

    function() external payable {
    }

    /**
    * @dev initialize an action if there's no in flight action
    or sign the current action if the second owner is calling the same 
    function with the same parameters (same call data)
    */
    function _initOrSignOwnerAction(string memory _actionName) internal {
        require(!voted[msg.sender], "already voted");
        if (ownerAction.callData.length == 0) {
            emit ActionInitiated(_actionName);
            ownerAction.callData = msg.data;
        }
        require(keccak256(ownerAction.callData) == keccak256(msg.data), "different from the current action");
        ownerAction.approveSigs += 1;
        voted[msg.sender] = true;
    }

    function _deleteOwnerAction() internal {
        delete ownerAction;
        delete voted[ownerList[0]];
        delete voted[ownerList[1]];
        delete voted[ownerList[2]];
    }

    function msUpgradeImplementation(address _newImplementation) external onlyOwner {
        _initOrSignOwnerAction("msUpgradeImplementation");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(this)).upgradeTo(_newImplementation);
            emit ActionExecuted("msUpgradeImplementation");
            _deleteOwnerAction();
        } 
    }

    function msTransferProxyOwnership(address _newProxyOwner) external onlyOwner {
        _initOrSignOwnerAction("msTransferProxyOwnership");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(this)).transferProxyOwnership(_newProxyOwner);
            emit ActionExecuted("msTransferProxyOwnership");
            _deleteOwnerAction();
        } 
    }

    function msClaimProxyOwnership() external onlyOwner {
        _initOrSignOwnerAction("msClaimProxyOwnership");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(this)).claimProxyOwnership();
            emit ActionExecuted("msClaimProxyOwnership");
            _deleteOwnerAction();
        } 
    }

    /**
    * @dev Replace a current owner with a new owner
    */
    function msUpdateOwner (address _oldOwner, address _newOwner) external onlyOwner {
        require(owners[_oldOwner] && !owners[_newOwner]);
        _initOrSignOwnerAction("updateOwner");
        if (ownerAction.approveSigs > 1) {
            owners[_oldOwner] = false;
            owners[_newOwner] = true;
            for (uint8 i; i < 3; i++) {
                if (ownerList[i] == _oldOwner) {
                    ownerList[i] = _newOwner;
                }
            }
            emit ActionExecuted("updateOwner");
            _deleteOwnerAction();
        } 
    }


    /**
    * @dev Let MultisigOwner contract claim ownership of a claimable contract
    */
    function msIssueClaimContract(address _other) external onlyOwner {
        _initOrSignOwnerAction("msIssueClaimContract");
        if (ownerAction.approveSigs > 1) {
            Claimable other = Claimable(_other);
            other.claimOwnership();
            emit ActionExecuted("msIssueClaimContract");
            _deleteOwnerAction();
        } 
    }

    /**
    * @dev Transfer ownership of a contract that this contract owns to a new owner
    *@param _contractAddr The contract that this contract currently owns
    *@param _newOwner The address to which the ownership will be transferred to
    */
    function msReclaimContract(address _contractAddr, address _newOwner) external onlyOwner {
        _initOrSignOwnerAction("msReclaimContract");
        if (ownerAction.approveSigs > 1) {
            Ownable contractInst = Ownable(_contractAddr);
            contractInst.transferOwnership(_newOwner);
            emit ActionExecuted("msReclaimContract");
            _deleteOwnerAction();
        }
    }

    /**
    * @dev Transfer all eth in this contract address to another address
    *@param _to The eth will be send to this address
    */
    function msReclaimEther(address payable _to) external onlyOwner {
        _initOrSignOwnerAction("msReclaimEther");
        if (ownerAction.approveSigs > 1) {
            _to.transfer(address(this).balance);
            emit ActionExecuted("msReclaimEther");
            _deleteOwnerAction();
        }
    }

    /**
    * @dev Transfer all specifc tokens in this contract address to another address
    *@param _token The token address of the token
    *@param _to The tokens will be send to this address
    */
    function msReclaimToken(IERC20 _token, address _to) external onlyOwner {
        _initOrSignOwnerAction("msReclaimToken");
        if (ownerAction.approveSigs > 1) {
            uint256 balance = _token.balanceOf(address(this));
            _token.transfer(_to, balance);
            emit ActionExecuted("msReclaimToken");
            _deleteOwnerAction();
        }
    }

    /**
    * @dev Set the instance of TokenController that this contract will be calling
    */
    function msSetTokenController (address _newController) public onlyOwner {
        _initOrSignOwnerAction("msSetTokenController");
        if (ownerAction.approveSigs > 1) {
            tokenController = TokenController(_newController);
            emit ActionExecuted("msSetTokenController");
            _deleteOwnerAction();
        }    
    }

    function msTransferControllerProxyOwnership(address _newOwner) external onlyOwner {
        _initOrSignOwnerAction("msTransferControllerProxyOwnership");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(uint160(address(tokenController)))).transferProxyOwnership(_newOwner);
            emit ActionExecuted("msTransferControllerProxyOwnership");
            _deleteOwnerAction();
        }
    }

    function msClaimControllerProxyOwnership() external onlyOwner {
        _initOrSignOwnerAction("msClaimControllerProxyOwnership");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(uint160(address(tokenController)))).claimProxyOwnership();
            emit ActionExecuted("msClaimControllerProxyOwnership");
            _deleteOwnerAction();
        }
    }

    function msUpgradeControllerProxyImplTo(address _implementation) external onlyOwner {
        _initOrSignOwnerAction("msUpgradeControllerProxyImplTo");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(uint160(address(tokenController)))).upgradeTo(_implementation);
            emit ActionExecuted("msUpgradeControllerProxyImplTo");
            _deleteOwnerAction();
        }
    }


    /**
    * @dev Veto the current in flight action. Reverts if no current action
    */
    function msVeto() public onlyOwner {
        require(!voted[msg.sender], "already voted");
        require(ownerAction.callData.length > 0, "no action in flight");
        if (ownerAction.disappoveSigs >= 1) {
            emit ActionVetoed(ownerAction.actionName);
            _deleteOwnerAction();
        } else {
            ownerAction.disappoveSigs += 1;
            voted[msg.sender] = true;
        }
    }

    /**
    * @dev Internal function used to call functions of tokenController.
    If no in flight action, create a new one. Otherwise sign and the action
    if the msg.data matches call data matches. Reverts otherwise
    */
    function _signOrExecute(string memory _actionName) internal {
        _initOrSignOwnerAction(_actionName);
        if (ownerAction.approveSigs > 1) {
            (bool success,) = address(tokenController).call(msg.data);
            require(success, "tokenController call failed");
            emit ActionExecuted(_actionName);
            _deleteOwnerAction();
        }
    }

    /*
    ============================================
    THE FOLLOWING FUNCTIONS CALLED TO TokenController.
    They share the same function signatures as functions in TokenController.
    They will generate the correct callData so that the same function will be called
    in TokenController.
    */

    function initialize() external onlyOwner {
        _signOrExecute("initialize"); 
    }

    function transferTusdProxyOwnership(address /*_newOwner*/) external onlyOwner {
        _signOrExecute("transferTusdProxyOwnership"); 
    }
    
    function claimTusdProxyOwnership() external onlyOwner {
        _signOrExecute("claimTusdProxyOwnership"); 
    }

    function upgradeTusdProxyImplTo(address /*_implementation*/) external onlyOwner {
        _signOrExecute("upgradeTusdProxyImplTo"); 
    }

    function transferOwnership(address /*newOwner*/) external onlyOwner {
        _signOrExecute("transferOwnership"); 
    }

    function claimOwnership() external onlyOwner {
        _signOrExecute("claimOwnership"); 
    }

    function setMintThresholds(uint256 /*_instant*/, uint256 /*_ratified*/, uint256 /*_multiSig*/) external onlyOwner {
        _signOrExecute("setMintThresholds");
    }

    function setMintLimits(uint256 /*_instant*/, uint256 /*_ratified*/, uint256 /*_multiSig*/) external onlyOwner {
        _signOrExecute("setMintLimit");
    }

    function refillInstantMintPool() external onlyOwner {
        _signOrExecute("refillInstantMintPool");
    }

    function refillRatifiedMintPool() external onlyOwner {
        _signOrExecute("refillRatifiedMintPool");
    }

    function refillMultiSigMintPool() external onlyOwner {
        _signOrExecute("refillMultiSigMintPool");
    }

    function requestMint(address /*_to*/, uint256 /*_value*/) external onlyOwner {
        _signOrExecute("requestMint");
    }

    function instantMint(address /*_to*/, uint256 /*_value*/) external onlyOwner {
        _signOrExecute("instantMint");
    }

    function ratifyMint(uint256 /*_index*/, address /*_to*/, uint256 /*_value*/) external onlyOwner {
        _signOrExecute("ratifyMint");
    }
    
    function revokeMint(uint256 /*_index*/) external onlyOwner {
        _signOrExecute("revokeMint");
    }

    function transferMintKey(address /*_newMintKey*/) external onlyOwner {
        _signOrExecute("transferMintKey");
    }

    function invalidateAllPendingMints() external onlyOwner {
        _signOrExecute("invalidateAllPendingMints");
    } 

    function pauseMints() external onlyOwner {
        _signOrExecute("pauseMints");
    } 

    function unpauseMints() external onlyOwner {
        _signOrExecute("unpauseMints");
    } 

    function pauseMint(uint /*_opIndex*/) external onlyOwner {
        _signOrExecute("pauseMint");
    } 

    function unpauseMint(uint /*_opIndex*/) external onlyOwner {
        _signOrExecute("unpauseMint"); 
    }

    function setToken(CompliantDepositTokenWithHook /*_newContract*/) external onlyOwner {
        _signOrExecute("setToken"); 
    }

    function setRegistry(Registry /*_registry*/) external onlyOwner {
        _signOrExecute("setRegistry"); 
    }

    function setTokenRegistry(Registry /*_registry*/) external onlyOwner {
        _signOrExecute("setTokenRegistry"); 
    }

    function issueClaimOwnership(address /*_other*/) external onlyOwner {
        _signOrExecute("issueClaimOwnership"); 
    }

    function transferChild(Ownable /*_child*/, address /*_newOwner*/) external onlyOwner {
        _signOrExecute("transferChild"); 
    }

    function requestReclaimContract(Ownable /*_other*/) external onlyOwner {
        _signOrExecute("requestReclaimContract"); 
    }

    function requestReclaimEther() external onlyOwner {
        _signOrExecute("requestReclaimEther"); 
    }

    function requestReclaimToken(IERC20 /*_token*/) external onlyOwner {
        _signOrExecute("requestReclaimToken"); 
    } 

    function setFastPause(address /*_newFastPause*/) external onlyOwner {
        _signOrExecute("setFastPause"); 
    }

    function pauseToken() external onlyOwner {
        _signOrExecute("pauseToken"); 
    }

    function wipeBlackListedTrueUSD(address /*_blacklistedAddress*/) external onlyOwner {
        _signOrExecute("wipeBlackListedTrueUSD");
    }

    function setBurnBounds(uint256 /*_min*/, uint256 /*_max*/) external onlyOwner {
        _signOrExecute("setBurnBounds"); 
    }

    function reclaimEther(address /*_to*/) external onlyOwner {
        _signOrExecute("reclaimEther"); 
    }

    function reclaimToken(IERC20 /*_token*/, address /*_to*/) external onlyOwner {
        _signOrExecute("reclaimToken"); 
    }
}
