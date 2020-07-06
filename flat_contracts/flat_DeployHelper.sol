
// File: contracts/TrueCurrencies/TrueCoinReceiver.sol

pragma solidity 0.5.13;

contract TrueCoinReceiver {
    function tokenFallback( address from, uint256 value ) external;
}

// File: contracts/TrueReward/FinancialOpportunity.sol

pragma solidity 0.5.13;

/**
 * @title FinancialOpportunity
 * @dev Interface for third parties to implement financial opportunities
 *
 * -- Overview --
 * The goal of this contract is to allow anyone to create an opportunity
 * to earn interest on TUSD. deposit() "mints" yTUSD whcih is redeemable
 * for some amount of TUSD. TrueUSD wraps this contractwith TrustToken
 * Assurance, which provides protection from bugs and system design flaws
 * TUSD is a compliant stablecoin, therefore we do not allow transfers of
 * yTUSD, thus there are no transfer functions
 *
 * -- tokenValue() --
 * This function returns the value in TUSD of 1 yTUSD
 * This value should never decrease
 *
 * -- TUSD vs yTUSD --
 * yTUSD represents a fixed value which is redeemable for some amount of TUSD
 * Think of yTUSD like cTUSD, where cTokens are minted and increase in value versus
 * the underlying asset as interest is accrued
 *
 * -- totalSupply() --
 * This function returns the total supply of yTUSD issued by this contract
 * It is important to track this value accuratley and add/deduct the correct
 * amount on deposit/redemptions
 *
 * -- Assumptions --
 * - tokenValue can never decrease
 * - total TUSD owed to depositors = tokenValue() * totalSupply()
 */
interface FinancialOpportunity {

    /**
     * @dev Returns total supply of yTUSD in this contract
     *
     * @return total supply of yTUSD in this contract
    **/
    function totalSupply() external view returns (uint);

    /**
     * @dev Exchange rate between TUSD and yTUSD
     *
     * tokenValue should never decrease
     *
     * @return TUSD / yTUSD price ratio
     */
    function tokenValue() external view returns(uint);

    /**
     * @dev deposits TrueUSD and returns yTUSD minted
     *
     * We can think of deposit as a minting function which
     * will increase totalSupply of yTUSD based on the deposit
     *
     * @param from account to transferFrom
     * @param amount amount in TUSD to deposit
     * @return yTUSD minted from this deposit
     */
    function deposit(address from, uint amount) external returns(uint);

    /**
     * @dev Redeem yTUSD for TUSD and withdraw to account
     *
     * This function should use tokenValue to calculate
     * how much TUSD is owed. This function should burn yTUSD
     * after redemption
     *
     * This function must return value in TUSD
     *
     * @param to account to transfer TUSD for
     * @param amount amount in TUSD to withdraw from finOp
     * @return TUSD amount returned from this transaction
     */
    function redeem(address to, uint amount) external returns(uint);
}

// File: @openzeppelin/contracts/token/ERC20/IERC20.sol

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

pragma solidity 0.5.13;


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

pragma solidity 0.5.13;



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

// File: @openzeppelin/contracts/math/SafeMath.sol

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

pragma solidity 0.5.13;



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

pragma solidity 0.5.13;



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

pragma solidity 0.5.13;





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

    uint[] gasRefundPool_Deprecated;
    uint256 private redemptionAddressCount_Deprecated;
    uint256 public minimumGasPriceForFutureRefunds;

    mapping (address => uint256) _balanceOf;
    mapping (address => mapping (address => uint256)) _allowance;
    mapping (bytes32 => mapping (address => uint256)) attributes;

    // reward token storage
    mapping(address => FinancialOpportunity) finOps;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;

    // true reward allocation
    // proportion: 1000 = 100%
    struct RewardAllocation { uint proportion; address finOp; }
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

// File: contracts/TrueCurrencies/HasOwner.sol

pragma solidity 0.5.13;


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

// File: contracts/TrueCurrencies/ReclaimerToken.sol

pragma solidity 0.5.13;


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

pragma solidity 0.5.13;


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

pragma solidity 0.5.13;



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

pragma solidity 0.5.13;





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

pragma solidity 0.5.13;




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

pragma solidity 0.5.13;


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

pragma solidity 0.5.13;


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

pragma solidity 0.5.13;


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

pragma solidity 0.5.13;







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

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal returns (address) {
        if (uint256(_to) < REDEMPTION_ADDRESS_COUNT) {
            _value -= _value % CENT;
            _burnFromAllowanceAllArgs(_from, _to, _value, _spender);
            return _to;
        }

        (address finalTo, bool hasHook) = _requireCanTransferFrom(_spender, _from, _to);

        if (0 == _addBalance(finalTo, _value)) {
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

        return finalTo;
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal returns (address) {
        if (uint256(_to) < REDEMPTION_ADDRESS_COUNT) {
            _value -= _value % CENT;
            _burnFromAllArgs(_from, _to, _value);
            return _to;
        }

        (address finalTo, bool hasHook) = _requireCanTransfer(_from, _to);

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

        return finalTo;
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

// File: contracts/TrueCurrencies/RewardToken.sol

pragma solidity 0.5.13;



/**
 * @title RewardToken
 * @dev Non-transferrable token meant to represent
 * RewardTokens are TrueCurrencies owed by a financial opportunity
 *
 * -- Overview --
 * RewardTokens are redeemable for an underlying Token.
 * RewardTokens are non-transferrable for compliance reasons
 * The caller of depositor is responsible for exchanging their
 * tokens, rather just keep accounting of user rewardToken balances
 *
 * -- Financial Opportunity --
 * RewardTokens are backed by an underlying financial opportunity
 * Each financial opportunity can accept Token deposits for
 * See FinancialOpportunity.sol
 *
 * -- Mint/Redeem/Burn --
 * To create rewardTokens, we call mintRewardToken with some amount of TUSD
 * To redeem rewardTokens we call redeemRewardToken and recieve TUSD
 * Only the account that has rewardTokens can burn reward tokens. The only
 * time we would want to burn rewardTokens is if the underlying opportunity
 * is no longer redeemable, and we want to wipe the debt.
 *
 * -- Mint/Burn RewardBackedToken
 * RewardBackedToken represents TrueCurrencies supply backed by Rewards
 *
 */
contract RewardToken is CompliantDepositTokenWithHook {

    /* variables in proxy storage
    mapping(address => FinancialOpportunity) finOps;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;
    */

    // events for reward token
    event MintRewardToken(address indexed account, uint256 tokensDeposited, uint256 rewardTokensMinted, address indexed finOp);
    event RedeemRewardToken(address indexed account, uint256 tokensWithdrawn, uint256 rewardTokensRedeemed, address indexed finOp);
    event BurnRewardToken(address indexed account, uint256 rewardTokenAmount, address indexed finOp);

    // events for reward backed token
    event MintRewardBackedToken(address indexed account, uint256 indexed amount);
    event BurnRewardBackedToken(address indexed account, uint256 indexed amount);

    /**
     * @dev Only addresses registered in this contract's mapping are valid
     *
     * @param finOp reverts if this finOp is not registered
     */
    modifier validFinOp(address finOp) {
        require(finOp != address(0), "invalid opportunity");
        _;
    }

    /**
     * @dev get debt balance of account in rewardToken
     *
     * @param finOp financial opportunity
     */
    function rewardTokenSupply(
        address finOp
    ) public view validFinOp(finOp) returns (uint256) {
        return finOpSupply[finOp];
    }

    /**
     * @dev get debt balance of account in rewardToken
     *
     * @param account account to get rewardToken balance of
     * @param finOp financial opportunity
     */
    function rewardTokenBalance(
        address account,
        address finOp
    ) public view validFinOp(finOp) returns (uint256) {
        return finOpBalances[finOp][account];
    }

    /**
     * @dev mint rewardToken for financial opportunity
     *
     * For valid finOp, deposit Token into finOp
     * Update finOpSupply & finOpBalance for account
     * Emit mintRewardToken event on success
     *
     * @param account account to mint rewardToken for
     * @param depositAmount amount of depositToken to deposit
     * @param finOp financial opportunity address
     */
    function mintRewardToken(
        address account,
        uint256 depositAmount,
        address finOp
    ) internal validFinOp(finOp) returns (uint256) {
        // approve finOp can spend Token
        _setAllowance(account, finOp, depositAmount);

        // deposit into finOp
        uint256 rewardAmount = _getFinOp(finOp).deposit(account, depositAmount);

        // increase finOp rewardToken supply
        finOpSupply[finOp] = finOpSupply[finOp].add(rewardAmount);

        // increase account rewardToken balance
        _addRewardBalance(account, rewardAmount, finOp);

        // emit mint event
        emit MintRewardToken(account, depositAmount, rewardAmount, finOp);
        emit MintRewardBackedToken(account, depositAmount);
        emit Transfer(address(0), account, depositAmount);

        return rewardAmount;
    }

    /**
     * @dev redeem rewardToken balance for depositToken
     *
     * For valid finOp, deposit Token into finOp
     * Update finOpSupply & finOpBalance for account
     * Emit mintRewardToken event on success
     *
     * @param account account to redeem rewardToken for
     * @param rewardAmount rewardTokens amount to redeem
     * @param finOp financial opportunity address
     */
    function redeemRewardToken(
        address account,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) returns (uint256) {
        // require sufficient balance
        require(rewardTokenBalance(account, finOp) >= rewardAmount, "insufficient reward balance");

        // withdraw from finOp, giving TUSD to account
        uint256 tokenAmount = _getFinOp(finOp).redeem(account, rewardAmount);

        // decrease finOp rewardToken supply
        finOpSupply[finOp] = finOpSupply[finOp].sub(rewardAmount);

        // decrease account rewardToken balance
        _subRewardBalance(account, rewardAmount, finOp);

        emit RedeemRewardToken(account, tokenAmount, rewardAmount, finOp);
        emit BurnRewardBackedToken(account, tokenAmount);
        emit Transfer(account, address(0), tokenAmount);

        return tokenAmount;
    }

    /**
     * @dev burn rewardToken without redeeming
     *
     * Burn rewardToken for finOp
     *
     * @param account account to burn rewardToken for
     * @param rewardAmount rewardToken amount to burn
     * @param finOp financial opportunity address
     */
    function burnRewardToken(
        address account,
        uint256 rewardAmount,
        address finOp
    )
        internal
        validFinOp(finOp)
    {
        // burn call must come from sender
        require(msg.sender == account);

        // sender must have rewardToken amount to burn
        require(rewardTokenBalance(account, finOp) >= rewardAmount);

        // subtract reward balance from
        _subRewardBalance(account, rewardAmount, finOp);

        // reduce total supply
        finOpSupply[finOp].sub(rewardAmount);

        // calculate depositToken value
        uint256 tokenAmount = _toToken(rewardAmount, finOp);

        // burn event
        emit BurnRewardToken(account, rewardAmount, finOp);
        emit BurnRewardBackedToken(account, tokenAmount);
        emit Transfer(account, address(0), tokenAmount);
    }

    /**
     * @dev add rewardToken balance to account
     *
     * @param account account to add to
     * @param amount rewardToken amount to add
     * @param finOp financial opportunity to add reward tokens to
     */
    function _addRewardBalance(address account, uint256 amount, address finOp) internal {
        finOpBalances[finOp][account] = finOpBalances[finOp][account].add(amount);
    }

    /**
     * @dev subtract rewardToken balance from account
     *
     * @param account account to subtract from
     * @param amount rewardToken ammount to subtract
     * @param finOp financial opportunity
     */
    function _subRewardBalance(address account, uint256 amount, address finOp) internal {
        finOpBalances[finOp][account] = finOpBalances[finOp][account].sub(amount);
    }

    /**
     * @dev Utility to convert depositToken value to rewardToken value
     *
     * @param amount depositToken amount to convert to rewardToken
     * @param finOp financial opportunity address
     */
    function _toRewardToken(uint256 amount, address finOp) internal view returns (uint256) {
        uint256 ratio = _getFinOp(finOp).tokenValue();
        return amount.mul(10 ** 18).div(ratio);
    }

    /**
     * @dev Utility to convert rewardToken value to depositToken value
     *
     * @param amount rewardToken amount to convert to depositToken
     * @param finOp financial opportunity address
     */
    function _toToken(uint amount, address finOp) internal view returns (uint256) {
        uint256 ratio = _getFinOp(finOp).tokenValue();
        return ratio.mul(amount).div(10 ** 18);
    }

    /**
     * @dev utility to get FinancialOpportunity for address
     *
     * @param finOp financial opportunity to get
     */
    function _getFinOp(address finOp) internal view returns (FinancialOpportunity) {
        return FinancialOpportunity(finOp);
    }
}

// File: contracts/TrueCurrencies/RewardTokenWithReserve.sol

pragma solidity 0.5.13;


/**
 * @title RewardTokenWithReserve
 * @dev Provides a reserve to swap rewardTokens for gas savings
 *
 * -- Overview --
 * The Reserve holds Tokens and RewardTokens
 * Because gas costs can be high for depositing/redeeming in financial
 * opportunities, we use this contract to keep a reserve of tokens
 * to provide swap opportunities
 *
 */
contract RewardTokenWithReserve is RewardToken {

    // Reserve is an address which nobody has the private key to
    // Reserves of TUSD and TrueRewardBackedToken are held at this addess
    address public constant RESERVE = 0xf000000000000000000000000000000000000000;

    event ReserveDeposit(address indexed account, uint256 depositAmount, uint256 rewardTokenReturned, address indexed finOp);
    event ReserveRedeem(address indexed account, uint256 rewardTokenRedeemed, uint256 tokenAmountReturned, address indexed finOp);

    /**
     * @dev get reserve token balance
     *
     * @return token balance of reserve
     */
    function reserveBalance() public view returns (uint256) {
        return super.balanceOf(RESERVE);
    }

    /**
     * @dev Get rewardToken reserve balance
     *
     * @param finOp address of financial opportunity
     * @return rewardToken balance of reserve for finOp
     */
    function reserveRewardBalance(address finOp) public view returns (uint) {
        return rewardTokenBalance(RESERVE, finOp);
    }

    /**
     * @dev Withdraw Token from reserve through transferAll
     *
     * @param to address to withdraw to
     * @param value amount to withdraw
     */
    function reserveWithdraw(address to, uint256 value) external onlyOwner {
        _transferAllArgs(RESERVE, to, value);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is too much money in an opportunity and we want
     * to get more TrueCurrency.
     * This allows us to reduct the cost of transfers 5-10x in/out of opportunities
     *
     * @param tokenAmount amount of rewardTokens to redeem
     * @param finOp financial opportunity to redeem from
     */
    function reserveRedeem(uint256 tokenAmount, address finOp) internal {
        redeemRewardToken(RESERVE, tokenAmount, finOp);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is not enough rewardToken for an
     * opportunity and we want to add rewardTokens to the reserve
     *
     * @param rewardAmount amount of Token to redeem for rewardToken
     * @param finOp financial opportunity to redeem for
     */
    function reserveMint(uint256 rewardAmount, address finOp) internal {
        mintRewardToken(RESERVE, rewardAmount, finOp);
    }

    /**
     * @dev Use reserve to swap Token for rewardToken between accounts
     *
     * @param account account to swap token for
     * @param tokenAmount deposit token amount to withdraw from reserve
     * @param rewardAmount reward token amount to deposit into reserve
     * @param finOp financial opportunity to swap tokens for
     */
    function swapRewardForToken(
        address account,
        uint256 tokenAmount,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) {
        // put reward tokens into reserve
        _subRewardBalance(account, rewardAmount, finOp);
        _addRewardBalance(RESERVE, rewardAmount, finOp);

        // take deposit tokens from reserve
        _subBalance(RESERVE, tokenAmount);
        _addBalance(account, tokenAmount);

        emit Transfer(account, RESERVE, tokenAmount);
        emit Transfer(RESERVE, account, tokenAmount);
    }

    /**
     * @dev Use reserve to swap Token for rewardToken between accounts
     *
     * @param account account to swap token for
     * @param tokenAmount deposit token amount to deposit into reserve
     * @param rewardAmount reward token amount to withdraw from reserve
     * @param finOp financial opportunity to swap tokens for
     */
    function swapTokenForReward(
        address account,
        uint256 tokenAmount,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) {
        // deposit tokens into reserve
        _subBalance(account, tokenAmount);
        _addBalance(RESERVE, tokenAmount);

        // withdraw reward tokens from reserve
        _subRewardBalance(RESERVE, rewardAmount, finOp);
        _addRewardBalance(account, rewardAmount, finOp);

        // emit transfer events
        emit Transfer(account, RESERVE, tokenAmount);
        emit Transfer(RESERVE, account, tokenAmount);
    }

    /**
     * @dev Redeem tokens from financial opportunity if reserve balance cannot cover it
     * swap with reserve otherwise
     *
     * @param account account which wants to redeem
     * @param rewardAmount reward token amount to redeem
     * @param finOp financial opportunity we interact with
     * @return amount of depositTokens returned to account
     */
    function redeemWithReserve(address account, uint256 rewardAmount, address finOp) internal returns (uint256) {
        // calculate deposit amount
        uint256 tokenAmount = _toToken(rewardAmount, finOp);

        return redeemWithReserve(account, tokenAmount, rewardAmount, finOp);
    }

    function redeemWithReserve(address account, uint256 tokenAmount, uint256 rewardAmount, address finOp) internal returns (uint256) {
        // if sufficient reserve balance, make swap and emit event
        if (reserveBalance() >= tokenAmount) {
            swapRewardForToken(account, tokenAmount, rewardAmount, finOp);
            emit ReserveRedeem(account, rewardAmount, tokenAmount, finOp);
            return tokenAmount;
        }
        // otherwise redeem through opportunity
        else {
            return redeemRewardToken(account, rewardAmount, finOp);
        }
    }

    /**
     * @dev Deposit tokens into financial opportunity and mint new debt backed tokens
     * if reserve reward token balance is lower than deposited amount
     * swap with reserve otherwise
     *
     * @param account account which wants to redeem
     * @param depositAmount token amount to exchange for reward tokens
     * @param finOp financial opportunity we interact with
     * @return amount of rewardTokens exchanged to account
     */
    function depositWithReserve(address account, uint256 depositAmount, address finOp) internal returns (uint256) {
        // calculate reward token amount for deposit
        uint256 rewardAmount = _toRewardToken(depositAmount, finOp);

        // if sufficient reserve reward token balance, make swap and emit event
        if (rewardTokenBalance(RESERVE, finOp) >= rewardAmount) {
            swapTokenForReward(account, depositAmount, rewardAmount, finOp);
            emit ReserveDeposit(account, depositAmount, rewardAmount, finOp);
            return rewardAmount;
        }
        // otherwise mint new rewardTokens by depositing into opportunity
        else {
            return mintRewardToken(account, depositAmount, finOp);
        }
    }
}

// File: contracts/TrueCurrencies/TrueRewardBackedToken.sol

pragma solidity 0.5.13;




/**
 * @title TrueRewardBackedToken
 * @dev TrueRewardBackedToken is TrueCurrency backed by debt
 *
 * -- Overview --
 * Enabling TrueRewards deposits TrueCurrency into a financial opportunity
 * Financial opportunities provide awards over time
 * Awards are reflected in the wallet balance updated block-by-block
 *
 * -- rewardToken vs yToken --
 * rewardToken represents an amount of ASSURED TrueCurrency owed to the rewardToken holder
 * yToken represents an amount of NON-ASSURED TrueCurrency owed to a yToken holder
 * For this contract, we only handle rewardToken (Assured Opportunities)
 *
 * -- Calculating rewardToken --
 * TrueCurrency Value = rewardToken * financial opportunity tokenValue()
 *
 * -- rewardToken Assumptions --
 * We assume tokenValue never decreases for assured financial opportunities
 * rewardToken is not transferrable in that the token itself is never tranferred
 * Rather, we override our transfer functions to account for user balances
 *
 * -- Reserve --
 * This contract uses a reserve holding of TrueCurrency and rewardToken to save on gas costs
 * because calling the financial opportunity deposit() and redeem() everytime
 * can be expensive
 * See RewardTokenWithReserve.sol
 *
 * -- Future Upgrades to Financial Opportunity --
 * Currently, we only have a single financial opportunity
 * We plan on upgrading this contract to support a multiple financial opportunity,
 * so some of the code is built to support this
 *
 */
contract TrueRewardBackedToken is RewardTokenWithReserve {

    /* variables in Proxy Storage:
    mapping(address => FinancialOpportunity) finOps;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;
    uint256 maxRewardProportion = 1000;
    */

    // registry attribute for whitelist
    // 0x6973547275655265776172647357686974656c69737465640000000000000000
    bytes32 constant IS_TRUEREWARDS_WHITELISTED = "isTrueRewardsWhitelisted";

    // financial opportunity address
    address public opportunity_;

    event TrueRewardEnabled(address indexed _account, uint256 _amount, address indexed _finOp);
    event TrueRewardDisabled(address indexed _account, uint256 _amount, address indexed _finOp);

    /** @dev return true if TrueReward is enabled for a given address */
    function trueRewardEnabled(address _address) public view returns (bool) {
        return _rewardDistribution[_address].length != 0;
    }

    /**
     * @dev Get total supply of all TrueCurrency
     * Equal to deposit backed TrueCurrency plus debt backed TrueCurrency
     * @return total supply in trueCurrency
     */
    function totalSupply() public view returns (uint256) {
        // if supply in opportunity finOp, return supply of deposits + debt
        // otherwise call super to return normal totalSupply
        if (opportunityRewardSupply() != 0) {
            return totalSupply_.add(opportunityTotalSupply());
        }
        return totalSupply_;
    }

    /**
     * @dev get total supply of TrueCurrency backed by fiat deposits
     * @return supply of fiat backed TrueCurrency
     */
    function depositBackedSupply() public view returns (uint256) {
        return totalSupply_;
    }

    /**
     * @dev get total supply of TrueCurrency backed by debt
     * @return supply of debt backed TrueCurrency
     */
    function rewardBackedSupply() public view returns (uint256) {
        return totalSupply().sub(totalSupply_);
    }

    /**
     * @dev Get balance of TrueCurrency including rewards for an address
     *
     * @param _who address of account to get balanceOf for
     * @return balance total balance of address including rewards
     */
    function balanceOf(address _who) public view returns (uint256) {
        // if trueReward enabled, return token value of reward balance
        // otherwise call token balanceOf
        if (trueRewardEnabled(_who)) {
            return _toToken(rewardTokenBalance(_who, opportunity()), opportunity());
        }
        return super.balanceOf(_who);
    }

    /**
     * @dev Enable TrueReward and deposit user balance into opportunity.
     * Currently supports a single financial opportunity
     */
    function enableTrueReward() external {
        // require TrueReward is not enabled
        require(registry.hasAttribute(msg.sender, IS_TRUEREWARDS_WHITELISTED), "must be whitelisted to enable TrueRewards");
        require(!trueRewardEnabled(msg.sender), "TrueReward already enabled");

        // get sender balance
        uint balance = _getBalance(msg.sender);

        if (balance != 0) {
            // deposit entire user token balance
            depositWithReserve(msg.sender, balance, opportunity());
        }

        // set reward distribution
        // we set max distribution since we only have one opportunity
        _setDistribution(maxRewardProportion, opportunity());

        // emit enable event
        emit TrueRewardEnabled(msg.sender, balance, opportunity());
    }

    /**
     * @dev Disable TrueReward and withdraw user balance from opportunity.
     */
    function disableTrueReward() external {
        // require TrueReward is enabled
        require(trueRewardEnabled(msg.sender), "TrueReward already disabled");
        // get balance
        uint rewardBalance = rewardTokenBalance(msg.sender, opportunity());

        // remove reward distribution
        _removeDistribution(opportunity());

        if (rewardBalance > 0) {
            // redeem entire user reward token balance
            redeemWithReserve(msg.sender, rewardBalance, opportunity());
        }

        // emit disable event
        emit TrueRewardDisabled(msg.sender, rewardBalance, opportunity());
    }

    /**
     * @dev mint function for TrueRewardBackedToken
     * Mints TrueCurrency backed by debt
     * When we add multiple opportunities, this needs to work for mutliple interfaces
     */
    function mint(address _to, uint256 _value) public onlyOwner {
        // check if to address is enabled
        bool toEnabled = trueRewardEnabled(_to);

        // if to enabled, mint to this contract and deposit into finOp
        if (toEnabled) {
            // mint to this contract
            super.mint(address(this), _value);
            // transfer minted amount to target receiver
            _transferAllArgs(address(this), _to, _value);
        }
        // otherwise call normal mint process
        else {
            super.mint(_to, _value);
        }
    }

    /**
     * @dev redeem reserve rewardTokens for Token given a rewardToken amount
     * This is called by the TokenController to balance the reserve
     * @param _value amount of Token to deposit for rewardTokens
     */
    function opportunityReserveRedeem(uint256 _value) external onlyOwner {
        reserveRedeem(_value, opportunity());
    }

    /**
     * @dev mint reserve rewardTokens for opportunity given a Token deposit
     * This is called by the TokenController to balance the reserve
     * @param _value amount of Token to deposit for rewardTokens
     */
    function opportunityReserveMint(uint256 _value) external onlyOwner {
        reserveMint(_value, opportunity());
    }

    /**
     * @dev set a new opportunity financial opportunity address
     * @param _opportunity new opportunity to set
     */
    function setOpportunityAddress(address _opportunity) external onlyOwner {
        opportunity_ = _opportunity;
    }

    /**
     * @dev Get (assured) financial opportunity address
     * @return address financial opportunity address
     */
    function opportunity() public view returns (address) {
        return opportunity_;
    }

    /**
     * @dev Get total supply of opportunity rewardToken
     * @return total supply of opportunity rewardToken
     */
    function opportunityRewardSupply() internal view returns (uint256) {
        if (opportunity() == address(0)) {
            return 0;
        }
        return rewardTokenSupply(opportunity());
    }

    /**
     * @dev Get total supply of TrueCurrency in opportunity
     * @return total supply of TrueCurrency in opportunity
     */
    function opportunityTotalSupply() internal view returns (uint256) {
        return _toToken(opportunityRewardSupply(), opportunity());
    }

    /**
     * @dev Transfer helper function for TrueRewardBackedToken
     *
     * Uses trueRewardEnabled flag to check whether accounts have opted in
     * If are have opted out, call parent transferFrom, otherwise:
     * 1. If sender opted in, redeem reward tokens for true currency
     * 2. Call transferFrom, using deposit balance for transfer
     * 3. If reciever enabled, deposit true currency into
     */
    function _transferAllArgs(address _from, address _to, uint256 _value) internal returns (address) {
        // get enabled flags and opportunity address
        bool fromEnabled = trueRewardEnabled(_from);
        bool toEnabled = trueRewardEnabled(_to);
        address finOp = opportunity();

        // if both disabled or either is opportunity, tranfer normally
        if ((!fromEnabled && !toEnabled) || _from == finOp || _to == finOp) {
            require(super.balanceOf(_from) >= _value, "not enough balance");
            return super._transferAllArgs(_from, _to, _value);
        }

        // check balance for from address
        require(balanceOf(_from) >= _value, "not enough balance");

        // if from enabled, check balance, calculate reward amount, and redeem
        if (fromEnabled) {
            uint256 rewardAmount = _toRewardToken(_value, finOp);
            _value = redeemWithReserve(_from, _value, rewardAmount, finOp);
        }

        // transfer tokens
        address finalTo = super._transferAllArgs(_from, _to, _value);

        // if receiever enabled, deposit tokens into opportunity
        if (trueRewardEnabled(finalTo)) {
            depositWithReserve(finalTo, _value, finOp);
        }

        return finalTo;
    }

    /**
     * @dev TransferFrom helper function for TrueRewardBackedToken
     *
     * Uses trueRewardEnabled flag to check whether accounts have opted in
     * If are have opted out, call parent transferFrom, otherwise:
     * 1. If sender opted in, redeem reward tokens for true currency
     * 2. Call transferFrom, using deposit balance for transfer
     * 3. If reciever enabled, deposit true currency into
     */
    function _transferFromAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal returns (address) {
        // get enabled flags and opportunity address
        bool fromEnabled = trueRewardEnabled(_from);
        bool toEnabled = trueRewardEnabled(_to);
        address finOp = opportunity();

        // if both disabled or either is opportunity, tranfer normally
        if ((!fromEnabled && !toEnabled) || _from == finOp || _to == finOp) {
            require(super.balanceOf(_from) >= _value, "not enough balance");
            return super._transferFromAllArgs(_from, _to, _value, _spender);
        }

        // check balance for from address
        require(balanceOf(_from) >= _value, "not enough balance");

        // if from enabled, check balance, calculate reward amount, and redeem
        if (fromEnabled) {
            uint256 rewardAmount = _toRewardToken(_value, finOp);
            _value = redeemWithReserve(_from, rewardAmount, finOp);
        }

        // transfer tokens
        address finalTo = super._transferFromAllArgs(_from, _to, _value, _spender);

        // if receiever enabled, deposit tokens into opportunity
        if (trueRewardEnabled(finalTo)) {
            depositWithReserve(finalTo, _value, finOp);
        }

        return finalTo;
    }

    /**
     * @dev Set reward distribution for an opportunity
     *
     * @param proportion to set
     * @param finOp financial opportunity to set proportion for
     */
    function _setDistribution(uint256 proportion, address finOp) internal {
        require(proportion <= maxRewardProportion, "exceeds maximum proportion");
        require(_rewardDistribution[msg.sender].length == 0, "already enabled");
        _rewardDistribution[msg.sender].push(
            RewardAllocation(proportion, finOp));
    }

    /**
     * @dev Remove reward distribution for a financial opportunity
     * Remove
     */
    function _removeDistribution(address finOp) internal {
        delete _rewardDistribution[msg.sender][0];
        _rewardDistribution[msg.sender].length--;
    }
}

// File: contracts/TrueCurrencies/DelegateERC20.sol

pragma solidity 0.5.13;


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

pragma solidity 0.5.13;





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
}

// File: @trusttoken/registry/contracts/ProvisionalRegistry.sol

pragma solidity ^0.5.13;


contract ProvisionalRegistry is Registry {
    bytes32 constant IS_BLACKLISTED = "isBlacklisted";
    bytes32 constant IS_DEPOSIT_ADDRESS = "isDepositAddress";
    bytes32 constant IS_REGISTERED_CONTRACT = "isRegisteredContract";
    bytes32 constant CAN_BURN = "canBurn";

    function requireCanTransfer(address _from, address _to) public view returns (address, bool) {
        require (attributes[_from][IS_BLACKLISTED].value == 0, "blacklisted");
        uint256 depositAddressValue = attributes[address(uint256(_to) >> 20)][IS_DEPOSIT_ADDRESS].value;
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        require (attributes[_to][IS_BLACKLISTED].value == 0, "blacklisted");
        return (_to, attributes[_to][IS_REGISTERED_CONTRACT].value != 0);
    }

    function requireCanTransferFrom(address _sender, address _from, address _to) public view returns (address, bool) {
        require (attributes[_sender][IS_BLACKLISTED].value == 0, "blacklisted");
        return requireCanTransfer(_from, _to);
    }

    function requireCanMint(address _to) public view returns (address, bool) {
        require (attributes[_to][IS_BLACKLISTED].value == 0, "blacklisted");
        uint256 depositAddressValue = attributes[address(uint256(_to) >> 20)][IS_DEPOSIT_ADDRESS].value;
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        return (_to, attributes[_to][IS_REGISTERED_CONTRACT].value != 0);
    }

    function requireCanBurn(address _from) public view {
        require (attributes[_from][CAN_BURN].value != 0);
        require (attributes[_from][IS_BLACKLISTED].value == 0);
    }
}

// File: contracts/mocks/RegistryImplementation.sol

pragma solidity 0.5.13;



/**
 * @title RegistryImplementation
 * Used as implementation for registry in truecurrencies
 */
contract RegistryImplementation is Registry {
    /**
    * @dev sets the original `owner` of the contract to the sender
    * at construction. Must then be reinitialized
    */
    constructor() public {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
    }

    function registryOwner() public view returns (address) {
        return owner;
    }

    function initialize() public {
        require(!initialized, "already initialized");
        owner = msg.sender;
        initialized = true;
    }
}

/**
 * @title RegistryImplementation
 * Used as implementation for registry in truecurrencies
 */
contract ProvisionalRegistryImplementation is
    RegistryImplementation,
    ProvisionalRegistry {
}

// File: contracts/TrueCurrencies/Proxy/OwnedUpgradeabilityProxy.sol

pragma solidity 0.5.13;

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
    bytes32 private constant proxyOwnerPosition = 0x6279e8199720cf3557ecd8b58d667c8edc486bd1cf3ad59ea9ebdfcae0d0dfac;
    //keccak256("trueUSD.proxy.owner");

    bytes32 private constant pendingProxyOwnerPosition = 0x8ddbac328deee8d986ec3a7b933a196f96986cb4ee030d86cc56431c728b83f4;
    //keccak256("trueUSD.pending.proxy.owner");

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
    bytes32 private constant implementationPosition = 0x6e41e0fbe643dfdb6043698bf865aada82dc46b953f754a3468eaa272a362dc7;
    //keccak256("trueUSD.proxy.implementation");

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

// File: contracts/TrueCurrencies/Admin/TokenController.sol

pragma solidity 0.5.13;








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

    TrueUSD public token;
    Registry public registry;
    address public fastPause;
    address public trueRewardManager;

    bytes32 constant public IS_MINT_PAUSER = "isTUSDMintPausers";
    bytes32 constant public IS_MINT_RATIFIER = "isTUSDMintRatifier";
    bytes32 constant public IS_REDEMPTION_ADMIN = "isTUSDRedemptionAdmin";

    // paused version of TrueUSD in Production
    // pausing the contract upgrades the proxy to this implementation
    address constant public PAUSED_IMPLEMENTATION = 0x3c8984DCE8f68FCDEEEafD9E0eca3598562eD291;

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

    modifier onlyTrueRewardManager() {
        require(msg.sender == trueRewardManager, "must be trueRewardManager");
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
    event SetToken(TrueUSD newContract);

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
    function setToken(TrueUSD _newContract) external onlyOwner {
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
    function requestReclaimContract(InstantiatableOwnable _other) public onlyOwner {
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

    /*
    ========================================
    Truereward
    ========================================
    */

    /**
     * @dev Sets the contract which has permissions to manage truerewards reserve
     * Controls access to reserve functions to allow providing liquidity
     */
    function setTrueRewardManager(address _newTrueRewardManager) external onlyOwner {
        trueRewardManager = _newTrueRewardManager;
    }

    /**
     * @dev Sets the contract which has permissions to manage truerewards reserve
     * Controls access to reserve functions to allow providing liquidity
     */
    function setOpportunityAddress(address _opportunityAddress) external onlyOwner {
        token.setOpportunityAddress(_opportunityAddress);
    }

    /**
     * @dev Withdraw all TrueCurrencies from reserve
     * @param _to address to withdraw to
     * @param _value amount to withdraw
     */
    function reserveWithdraw(address _to, uint256 _value) external onlyTrueRewardManager {
        token.reserveWithdraw(_to, _value);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is not enough money in opportunity reserve and we want
     * to get more opportunity tokens
     *
     * @param _value amount to exchange for opportunity rewardTokens
     */
    function opportunityReserveMint(uint256 _value) external onlyTrueRewardManager {
        token.opportunityReserveMint(_value);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is too much money in opportunity and we want
     * to get more TrueCurrency.
     *
     * @param _value amount of opportunity rewardTokens to redeem for TrueCurrency
     */
    function opportunityReserveRedeem(uint256 _value) external onlyTrueRewardManager {
        token.opportunityReserveRedeem(_value);
    }
}

// File: @trusttoken/trusttokens/contracts/ValSafeMath.sol

pragma solidity 0.5.13;

/**
 * Forked subset of Openzeppelin SafeMath allowing custom underflow/overflow messages
 * Useful for debugging, replaceable with standard SafeMath
 */
library ValSafeMath {
    function add(uint256 a, uint256 b, string memory overflowMessage) internal pure returns (uint256 result) {
        result = a + b;
        require(result >= a, overflowMessage);
    }
    function sub(uint256 a, uint256 b, string memory underflowMessage) internal pure returns (uint256 result) {
        require(b <= a, underflowMessage);
        result = a - b;
    }
    function mul(uint256 a, uint256 b, string memory overflowMessage) internal pure returns (uint256 result) {
        if (a == 0) {
            return 0;
        }
        result = a * b;
        require(result / a == b, overflowMessage);
    }
    function div(uint256 a, uint256 b, string memory divideByZeroMessage) internal pure returns (uint256 result) {
        require(b > 0, divideByZeroMessage);
        result = a / b;
    }
}

// File: @trusttoken/trusttokens/contracts/ILiquidator.sol

pragma solidity 0.5.13;


/**
 * @title Liquidator Interface
 * @dev Liquidate stake token for reward token
 */
contract ILiquidator {

    /** @dev Get output token (token to get from liquidation exchange). */
    function outputToken() internal view returns (IERC20);

    /** @dev Get stake token (token to be liquidated). */
    function stakeToken() internal view returns (IERC20);

    /** @dev Address of staking pool. */
    function pool() internal view returns (address);

    /**
     * @dev Transfer stake without liquidation
     */
    function reclaimStake(address _destination, uint256 _stake) external;

    /**
     * @dev Award stake tokens to stakers
     * Transfer to the pool without creating a staking position
     * Allows us to reward as staking or reward token
     */
    function returnStake(address _from, uint256 balance) external;

    /**
     * @dev Sells stake for underlying asset and pays to destination.
     */
    function reclaim(address _destination, int256 _debt) external;
}

// File: @trusttoken/trusttokens/contracts/ALiquidatorUniswap.sol

pragma solidity 0.5.13;

//pragma experimental ABIEncoderV2;






/**
 * @dev Uniswap
 * This is nessesary since Uniswap is written in vyper.
 */
interface UniswapV1 {
    function tokenToExchangeSwapInput(uint256 tokensSold, uint256 minTokensBought, uint256 minEthBought, uint256 deadline, UniswapV1 exchangeAddress) external returns (uint256 tokensBought);
    function tokenToExchangeTransferInput(uint256 tokensSold, uint256 minTokensBought, uint256 minEthBought, uint256 deadline, address recipient, UniswapV1 exchangeAddress) external returns (uint256 tokensBought);
    function tokenToExchangeSwapOutput(uint256 tokensBought, uint256 maxTokensSold, uint256 maxEthSold, uint256 deadline, UniswapV1 exchangeAddress) external returns (uint256 tokensSold);
    function tokenToExchangeTransferOutput(uint256 tokensBought, uint256 maxTokensSold, uint256 maxEthSold, uint256 deadline, address recipient, UniswapV1 exchangeAddress) external returns (uint256 tokensSold);
}

/**
 * @dev Uniswap Factory
 * This is nessesary since Uniswap is written in vyper.
 */
interface UniswapV1Factory {
    function getExchange(IERC20 token) external returns (UniswapV1);
}

/**
 * @title Abstract Uniswap Liquidator
 * @dev Liquidate staked tokenns on uniswap.
 * This is because there are multiple instances of AirswapV2.
 * StakingOpportunityFactory does not create a Liquidator, rather this must be created
 * Outside of the factory.
 */
contract ALiquidatorUniswap is ILiquidator {
    using ValSafeMath for uint256;

    // owner, registry attributes
    address public owner;
    address public pendingOwner;
    mapping (address => uint256) attributes;


    // constants
    bytes32 constant APPROVED_BENEFICIARY = "approvedBeneficiary";
    uint256 constant LIQUIDATOR_CAN_RECEIVE     = 0xff00000000000000000000000000000000000000000000000000000000000000;
    uint256 constant LIQUIDATOR_CAN_RECEIVE_INV = 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    // part of signature so that signing for airswap doesn't sign for all airswap instances
    uint256 constant MAX_UINT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant MAX_UINT128 = 0xffffffffffffffffffffffffffffffff;
    bytes2 EIP191_HEADER = 0x1901;

    // internal variables implemented as storage by Liquidator
    // these variables must be known at construction time
    // Liquidator is the actual implementation of ALiquidator

    /** @dev Get output token (token to get from liqudiation exchange). */
    function outputToken() internal view returns (IERC20);
    /** @dev Get stake token (token to be liquidated). */
    function stakeToken() internal view returns (IERC20);
    /** @dev Output token on uniswap. */
    function outputUniswapV1() internal view returns (UniswapV1);
    /** @dev Stake token on uniswap. */
    function stakeUniswapV1() internal view returns (UniswapV1);
    /** @dev Contract registry. */
    function registry() internal view returns (Registry);
    /** @dev Address of staking pool. */
    function pool() internal view returns (address);

    /**
     * @dev implementation constructor needs to call initialize
     * Here we approve transfers to uniswap for the staking and output token
     */
    function initialize() internal {
        outputToken().approve(address(outputUniswapV1()), MAX_UINT);
        stakeToken().approve(address(stakeUniswapV1()), MAX_UINT);
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Liquidated(uint256 indexed stakeAmount, uint256 indexed debtAmount);

    modifier onlyRegistry {
        require(msg.sender == address(registry()), "only registry");
        _;
    }

    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner, "only pending owner");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner = newOwner;
    }

    function claimOwnership() public onlyPendingOwner {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /**
     * @dev Two flags are supported by this function:
     * Supports APPROVED_BENEFICIARY
     * Can sync by saying this contract is the registry or sync from registry directly.
     */
    function syncAttributeValue(address _account, bytes32 _attribute, uint256 _value) external onlyRegistry {
        if (_attribute == APPROVED_BENEFICIARY) {
            // approved beneficiary flag defines whether someone can receive
            if (_value > 0) {
                attributes[_account] |= LIQUIDATOR_CAN_RECEIVE;
            } else {
                attributes[_account] &= LIQUIDATOR_CAN_RECEIVE_INV;
            }
        }
    }

    struct UniswapState {
        UniswapV1 uniswap;
        uint256 etherBalance;
        uint256 tokenBalance;
    }

    /**
     * @dev Calculate how much output we get for a stake input amount
     * Much cheaper to do this logic ourselves locally than an external call
     * Allows us to do this multiple times in one transaction
     * See ./uniswap/uniswap_exchange.vy
     */
    function outputForUniswapV1Input(uint256 stakeInputAmount, UniswapState memory outputUniswapV1State, UniswapState memory stakeUniswapV1State) internal pure returns (uint256 outputAmount) {
        uint256 inputAmountWithFee = 997 * stakeInputAmount;
        inputAmountWithFee = 997 * (inputAmountWithFee * stakeUniswapV1State.etherBalance) / (stakeUniswapV1State.tokenBalance * 1000 + inputAmountWithFee);
        outputAmount = (inputAmountWithFee * outputUniswapV1State.tokenBalance) / (outputUniswapV1State.etherBalance * 1000 + inputAmountWithFee);
    }

    /**
     * @dev Calcualte how much input we need to get a desired output
     * Is able to let us know if there is slippage in uniswap exchange rate
     * and continue with Airswap
     * See./uniswap/uniswap_exchange.vy
     */
    function inputForUniswapV1Output(uint256 outputAmount, UniswapState memory outputUniswapV1State, UniswapState memory stakeUniswapV1State) internal pure returns (uint256 inputAmount) {
        if (outputAmount >= outputUniswapV1State.tokenBalance) {
            return MAX_UINT128;
        }
        uint256 ethNeeded = (outputUniswapV1State.etherBalance * outputAmount * 1000) / (997 * (outputUniswapV1State.tokenBalance - outputAmount)) + 1;
        if (ethNeeded >= stakeUniswapV1State.etherBalance) {
            return MAX_UINT128;
        }
        inputAmount = (stakeUniswapV1State.tokenBalance * ethNeeded * 1000) / (997 * (stakeUniswapV1State.etherBalance - ethNeeded)) + 1;
    }

    /**
     * @dev Transfer stake without liquidation
     * requires LIQUIDATOR_CAN_RECEIVE flag (recipient must be registered)
     */
    function reclaimStake(address _destination, uint256 _stake) external onlyOwner {
        require(attributes[_destination] & LIQUIDATOR_CAN_RECEIVE != 0, "unregistered recipient");
        stakeToken().transferFrom(pool(), _destination, _stake);
    }

    /**
     * @dev Award stake tokens to stakers.
     * Transfer to the pool without creating a staking position.
     * Allows us to reward as staking or reward token.
     */
    function returnStake(address _from, uint256 balance) external {
        stakeToken().transferFrom(_from, pool(), balance);
    }

    /**
     * @dev Sells stake for underlying asset and pays to destination.
     * Use airswap trades as long as they're better than uniswap.
     * Contract won't slip Uniswap this way.
     * If we reclaim more than we actually owe we award to stakers.
     * Not possible to convert back into TrustTokens here.
     */
    function reclaim(address _destination, int256 _debt) external onlyOwner {
        require(_debt > 0, "Must reclaim positive amount");
        require(_debt < int256(MAX_UINT128), "reclaim amount too large");
        require(attributes[_destination] & LIQUIDATOR_CAN_RECEIVE != 0, "unregistered recipient");

        // get balance of stake pool
        address stakePool = pool();
        uint256 remainingStake = stakeToken().balanceOf(stakePool);

        // withdraw to liquidator
        require(stakeToken().transferFrom(stakePool, address(this), remainingStake),
            "liquidator not approved to transferFrom stakeToken");

        // load uniswap state for output and staked token
        UniswapState memory outputUniswapV1State;
        UniswapState memory stakeUniswapV1State;
        outputUniswapV1State.uniswap = outputUniswapV1();
        outputUniswapV1State.etherBalance = address(outputUniswapV1State.uniswap).balance;
        outputUniswapV1State.tokenBalance = outputToken().balanceOf(address(outputUniswapV1State.uniswap));
        stakeUniswapV1State.uniswap = stakeUniswapV1();
        stakeUniswapV1State.etherBalance = address(stakeUniswapV1State.uniswap).balance;
        stakeUniswapV1State.tokenBalance = stakeToken().balanceOf(address(stakeUniswapV1State.uniswap));

        // calculate remaining debt
        int256 remainingDebt = _debt;

        // if we have remaining debt and stake, we use Uniswap
        // we can use uniswap by specifying desired output or input
        if (remainingDebt > 0) {
            if (remainingStake > 0) {
                if (outputForUniswapV1Input(remainingStake, outputUniswapV1State, stakeUniswapV1State) < uint256(remainingDebt)) {
                    // liquidate all remaining stake :(
                    uint256 outputAmount = stakeUniswapV1State.uniswap.tokenToExchangeSwapInput(remainingStake, 1, 1, block.timestamp, outputUniswapV1State.uniswap);
                    emit Liquidated(remainingStake, outputAmount);

                    // update remaining stake and debt
                    remainingDebt -= int256(outputAmount);
                    remainingStake = 0;

                    // send output token to destination
                    outputToken().transfer(_destination, uint256(_debt - remainingDebt));
                } else {
                    // finish liquidation via uniswap
                    uint256 stakeSold = stakeUniswapV1State.uniswap.tokenToExchangeSwapOutput(uint256(remainingDebt), remainingStake, MAX_UINT, block.timestamp, outputUniswapV1State.uniswap);
                    emit Liquidated(stakeSold, uint256(remainingDebt));
                    remainingDebt = 0;
                    remainingStake -= stakeSold;
                    //
                    outputToken().transfer(_destination, uint256(_debt));
                }
            }
        } else {
            // if we end up with a tiny amount of delta, transfer to the pool
            if (remainingDebt < 0) {
                outputToken().transfer(stakePool, uint256(-remainingDebt));
            }

            // transfer output token to destination
            outputToken().transfer(_destination, uint256(_debt));
        }

        // if there is remaining stake, return remainder to pool
        if (remainingStake > 0) {
            stakeToken().transfer(stakePool, remainingStake);
        }
    }
}

// File: @trusttoken/trusttokens/contracts/Liquidator.sol

pragma solidity 0.5.13;

//pragma experimental ABIEncoderV2;


/**
 * @title Liquidator
 * @dev Implementation of ALiquidator
**/
contract Liquidator is ALiquidatorUniswap {
    address pool_;
    Registry registry_;
    IERC20 outputToken_;
    IERC20 stakeToken_;
    UniswapV1 outputUniswap_;
    UniswapV1 stakeUniswap_;
    bool initialized;

    function configure(
        address registryAddress,
        address outputTokenAddress,
        address stakeTokenAddress,
        address outputUniswapAddress,
        address stakeUniswapAddress
    ) external {
        require(!initialized, "already initialized");
        registry_ = Registry(registryAddress);
        outputToken_ = IERC20(outputTokenAddress);
        stakeToken_ = IERC20(stakeTokenAddress);
        outputUniswap_ = UniswapV1(outputUniswapAddress);
        stakeUniswap_ = UniswapV1(stakeUniswapAddress);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
        initialized = true;
        initialize();
    }
    function setPool(address _pool) external onlyOwner {
        pool_ = _pool;
    }
    function pool() internal view returns (address) {
        return pool_;
    }
    function outputToken() internal view returns (IERC20) {
        return outputToken_;
    }
    function stakeToken() internal view returns (IERC20) {
        return stakeToken_;
    }
    function registry() internal view returns (Registry) {
        return registry_;
    }
    function outputUniswapV1() internal view returns (UniswapV1) {
        return outputUniswap_;
    }
    function stakeUniswapV1() internal view returns (UniswapV1) {
        return stakeUniswap_;
    }
}

// File: @trusttoken/trusttokens/contracts/StakingAsset.sol

pragma solidity 0.5.13;


contract StakingAsset is IERC20 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

// File: @trusttoken/trusttokens/contracts/ProxyStorage.sol

pragma solidity 0.5.13;


/**
 * All storage must be declared here
 * New storage must be appended to the end
 * Never remove items from this list
 */
contract ProxyStorage {
    bool initalized;
    uint256 public totalSupply;

    mapping (address => uint256) public balanceOf;
    mapping (address => mapping (address => uint256)) public allowance;
    mapping (uint144 => uint256) attributes; // see RegistrySubscriber

    address owner_;
    address pendingOwner_;

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
     ** 64         uint256(address),uint256(1)                                   balanceOf
     ** 64         uint256(address),keccak256(uint256(address),uint256(2))       allowance
     ** 64         uint256(address),keccak256(bytes32,uint256(3))                attributes
    **/
}

// File: @trusttoken/trusttokens/contracts/ERC20.sol

pragma solidity 0.5.13;




// Fork of OpenZeppelin's BasicToken
/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract ModularBasicToken is ProxyStorage {
    using ValSafeMath for uint256;

    event Transfer(address indexed from, address indexed to, uint256 value);

    function _addBalance(address _who, uint256 _value) internal returns (uint256 priorBalance) {
        priorBalance = balanceOf[_who];
        balanceOf[_who] = priorBalance.add(_value, "balance overflow");
    }

    function _subBalance(address _who, uint256 _value) internal returns (uint256 result) {
        result = balanceOf[_who].sub(_value, "insufficient balance");
        balanceOf[_who] = result;
    }

    function _setBalance(address _who, uint256 _value) internal {
        balanceOf[_who] = _value;
    }
}

/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic standard token.
 * @dev https://github.com/ethereum/EIPs/issues/20
 * @dev Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract ModularStandardToken is ModularBasicToken {
    using ValSafeMath for uint256;
    uint256 constant INFINITE_ALLOWANCE = 0xfe00000000000000000000000000000000000000000000000000000000000000;

    event Approval(address indexed owner, address indexed spender, uint256 value);

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
    function increaseApproval(address _spender, uint _addedValue) public returns (bool) {
        _increaseApprovalAllArgs(_spender, _addedValue, msg.sender);
        return true;
    }

    function _increaseApprovalAllArgs(address _spender, uint256 _addedValue, address _tokenHolder) internal {
        _addAllowance(_tokenHolder, _spender, _addedValue);
        emit Approval(_tokenHolder, _spender, allowance[_tokenHolder][_spender]);
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
    function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool) {
        _decreaseApprovalAllArgs(_spender, _subtractedValue, msg.sender);
        return true;
    }

    function _decreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address _tokenHolder) internal {
        uint256 oldValue = allowance[_tokenHolder][_spender];
        uint256 newValue;
        if (_subtractedValue > oldValue) {
            newValue = 0;
        } else {
            newValue = oldValue - _subtractedValue;
        }
        _setAllowance(_tokenHolder, _spender, newValue);
        emit Approval(_tokenHolder,_spender, newValue);
    }

    function _addAllowance(address _who, address _spender, uint256 _value) internal {
        allowance[_who][_spender] = allowance[_who][_spender].add(_value, "allowance overflow");
    }

    function _subAllowance(address _who, address _spender, uint256 _value) internal returns (uint256 newAllowance){
        newAllowance = allowance[_who][_spender].sub(_value, "insufficient allowance");
        if (newAllowance < INFINITE_ALLOWANCE) {
            allowance[_who][_spender] = newAllowance;
        }
    }

    function _setAllowance(address _who, address _spender, uint256 _value) internal {
        allowance[_who][_spender] = _value;
    }
}

// File: @trusttoken/trusttokens/contracts/RegistrySubscriber.sol

pragma solidity 0.5.13;


contract RegistrySubscriber is ProxyStorage {
    // Registry Attributes
    bytes32 constant PASSED_KYCAML = "hasPassedKYC/AML";
    bytes32 constant IS_DEPOSIT_ADDRESS = "isDepositAddress";
    bytes32 constant BLACKLISTED = 0x6973426c61636b6c697374656400000000000000000000000000000000000000;
    bytes32 constant REGISTERED_CONTRACT = 0x697352656769737465726564436f6e7472616374000000000000000000000000;

    // attributes Bitmasks
    uint256 constant ACCOUNT_BLACKLISTED     = 0xff00000000000000000000000000000000000000000000000000000000000000;
    uint256 constant ACCOUNT_BLACKLISTED_INV = 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ACCOUNT_KYC             = 0x00ff000000000000000000000000000000000000000000000000000000000000;
    uint256 constant ACCOUNT_KYC_INV         = 0xff00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ACCOUNT_ADDRESS         = 0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff;
    uint256 constant ACCOUNT_ADDRESS_INV     = 0xffffffffffffffffffffffff0000000000000000000000000000000000000000;
    uint256 constant ACCOUNT_HOOK            = 0x0000ff0000000000000000000000000000000000000000000000000000000000;
    uint256 constant ACCOUNT_HOOK_INV        = 0xffff00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    function registry() internal view returns (Registry);

    modifier onlyRegistry {
        require(msg.sender == address(registry()));
        _;
    }

    /**
        Attributes are set per autosweep account
        The layout of attributes is detailed here
        lower bytes -> upper bytes
        [0, 20)  recipient address
        [29, 30) REGISTERED_CONTRACT
        [30, 31) PASSED_KYCAML
        [31, 32) BLACKLISTED
    */
    function syncAttributeValue(address _who, bytes32 _attribute, uint256 _value) public onlyRegistry {
        uint144 who = uint144(uint160(_who) >> 20);
        uint256 prior = attributes[who];
        if (prior == 0) {
            prior = uint256(_who);
        }
        if (_attribute == IS_DEPOSIT_ADDRESS) {
            if (address(prior) != address(_value)) {
                // TODO sweep balance from address(prior) to address(_value)
            }
            attributes[who] = (prior & ACCOUNT_ADDRESS_INV) | uint256(address(_value));
        } else if (_attribute == BLACKLISTED) {
            if (_value != 0) {
                attributes[who] = prior | ACCOUNT_BLACKLISTED;
            } else  {
                attributes[who] = prior & ACCOUNT_BLACKLISTED_INV;
            }
        } else if (_attribute == PASSED_KYCAML) {
            if (_value != 0) {
                attributes[who] = prior | ACCOUNT_KYC;
            } else {
                attributes[who] = prior & ACCOUNT_KYC_INV;
            }
        } else if (_attribute == REGISTERED_CONTRACT) {
            if (_value != 0) {
                attributes[who] = prior | ACCOUNT_HOOK;
            } else {
                attributes[who] = prior & ACCOUNT_HOOK_INV;
            }
        }
    }
}

// File: @trusttoken/trusttokens/contracts/TrueCoinReceiver.sol

pragma solidity 0.5.13;

contract TrueCoinReceiver {
    function tokenFallback( address from, uint256 value ) external;
}

// File: @trusttoken/trusttokens/contracts/ValTokenWithHook.sol

pragma solidity 0.5.13;




contract ValTokenWithHook is IERC20, ModularStandardToken, RegistrySubscriber {

    event Burn(address indexed from, uint256 indexed amount);
    event Mint(address indexed to, uint256 indexed amount);

    function _resolveRecipient(address _to) internal view returns (address to, bool hook) {
        uint256 flags = (attributes[uint144(uint160(_to) >> 20)]);
        if (flags == 0) {
            to = _to;
            // attributes[uint144(uint160(to) >> 20)] = uint256(to);
            hook = false;
        } else {
            to = address(flags);
            hook = (flags & ACCOUNT_HOOK) != 0;
        }
    }

    modifier resolveSender(address _from) {
        uint256 flags = (attributes[uint144(uint160(_from) >> 20)]);
        address from = address(flags);
        if (from != address(0)) {
            require(from == _from, "account collision");
        }
        _;
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        _subAllowance(_from, _spender, _value);
        _transferAllArgs(_from, _to, _value);
    }
    function transferFrom(address _from, address _to, uint256 _value) external returns (bool) {
        _transferFromAllArgs(_from, _to, _value, msg.sender);
        return true;
    }
    function transfer(address _to, uint256 _value) external returns (bool) {
        _transferAllArgs(msg.sender, _to, _value);
        return true;
    }
    function _transferAllArgs(address _from, address _to, uint256 _value) internal resolveSender(_from) {
        _subBalance(_from, _value);
        emit Transfer(_from, _to, _value);
        bool hasHook;
        address to;
        (to, hasHook) = _resolveRecipient(_to);
        _addBalance(to, _value);
        if (_to != to) {
            emit Transfer(_to, to, _value);
        }
        if (hasHook) {
            TrueCoinReceiver(to).tokenFallback(_from, _value);
        }
    }

    function _burn(address _from, uint256 _value) internal returns (uint256 resultBalance_, uint256 resultSupply_) {
        emit Transfer(_from, address(0), _value);
        emit Burn(_from, _value);
        resultBalance_ = _subBalance(_from, _value);
        resultSupply_ = totalSupply.sub(_value, "removing more stake than in supply");
        totalSupply = resultSupply_;
    }

    function _mint(address _to, uint256 _value) internal {
        emit Transfer(address(0), _to, _value);
        emit Mint(_to, _value);
        (address to, bool hook) = _resolveRecipient(_to);
        if (_to != to) {
            emit Transfer(_to, to, _value);
        }
        _addBalance(to, _value);
        totalSupply = totalSupply.add(_value, "totalSupply overflow");
        if (hook) {
            TrueCoinReceiver(to).tokenFallback(address(0x0), _value);
        }
    }
}

// File: @trusttoken/trusttokens/contracts/AStakedToken.sol

pragma solidity 0.5.13;




/**
 * @title Abstract StakedToken
 * @dev Single token staking model for ERC-20
 * StakedToken represents a share in an Assurace Pool.
 * Accounts stake ERC-20 staking asset and recieve ERC-20 reward asset.
 * StakingOpportunityFactory creates instances of StakedToken
 */
contract AStakedToken is ValTokenWithHook {
    using ValSafeMath for uint256;

    // current representation of rewards per stake
    // this number only goes up
    uint256 cumulativeRewardsPerStake;

    // amount each account has claimed up to cumulativeRewardsPerStake
    // claiming rewards sets claimedRewardsPerStake to cumulativeRewardsPerStake
    mapping (address => uint256) claimedRewardsPerStake;

    // amount that has been awarded to the pool but not pool holders
    // tracks leftovers for when stake gets very large
    // strictly less than total supply, usually ever less than $1
    // rolls over the next time we award
    uint256 rewardsRemainder;

    // total value of stake not currently in supply and not currrently withdrawn
    // need this to calculate how many new staked tokens to awarn when depositing
    uint256 public stakePendingWithdrawal;

    // map accounts => timestamp => money
    // have to reference timestamp to access previous withdrawal
    // multiple withdrawals in the same block increase amount for that timestamp
    // same acconut that initiates withdrawal needs to complete withdrawal
    mapping (address => mapping (uint256 => uint256)) pendingWithdrawals;

    // unstake period in days
    uint256 constant UNSTAKE_PERIOD = 14 days;

    // PendingWithdrawal event is initiated when finalizing stake
    // used to help user interfaces
    event PendingWithdrawal(address indexed staker, uint256 indexed timestamp, uint256 indexed amount);

    /**
     * @dev Get unclaimed reward balance for staker
     * @param _staker address of staker
     * @return claimedRewards_ withdrawable amount of rewards belonging to this staker
    **/
    function unclaimedRewards(address _staker) public view returns (uint256 unclaimedRewards_) {
        uint256 stake = balanceOf[_staker];
        if (stake == 0) {
            return 0;
        }
        unclaimedRewards_ = stake.mul(cumulativeRewardsPerStake.sub(claimedRewardsPerStake[_staker], "underflow"), "unclaimed rewards overflow");
    }

    /// @return ERC-20 stake asset
    function stakeAsset() internal view returns (StakingAsset);

    /// @return ERC-20 reward asset
    function rewardAsset() internal view returns (StakingAsset);

    /// @return liquidator address
    function liquidator() internal view returns (address);

    // max int size to prevent overflow
    uint256 constant MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    // default ratio is how much we multiply trusttokens by to calculate stake
    // helps achieve precision when dividing
    uint256 constant DEFAULT_RATIO = 1000;

    /**
     * @dev Initialize function called by constructor
     * Approves liqudiator for maximum amount
    */
    function initialize() internal {
        stakeAsset().approve(liquidator(), MAX_UINT256);
    }

    /**
     * @dev Overrides from ValTokenWithHook to track rewards remainder
     * If account is zero, we consider this value for gas refund
     * When you transfer your stake you transfer your unclaimed rewards
     * Contracts that have this staking token don't know they have rewards
     * This way we an exchange on uniswap or other exchanges
     */
    function _transferAllArgs(address _from, address _to, uint256 _value) internal resolveSender(_from) {
        uint256 fromRewards = claimedRewardsPerStake[_from];
        if (_subBalance(_from, _value) == 0) {
            claimedRewardsPerStake[_from] = 0;
        }
        emit Transfer(_from, _to, _value);
        (address to, bool hasHook) = _resolveRecipient(_to);
        if (_to != to) {
            emit Transfer(_to, to, _value);
        }
        // here we track rewards remainder and claimed rewards per stake
        // claimed rewards per stake of _to is the weighted average of the
        // prior value and added value according to their unclaimedrewards
        uint256 priorBalance = _addBalance(to, _value);
        uint256 numerator = (_value * fromRewards + priorBalance * claimedRewardsPerStake[to]);
        uint256 denominator = (_value + priorBalance);
        uint256 result = numerator / denominator;
        uint256 remainder = numerator % denominator;
        if (remainder > 0) {
            // remainder always less than denominator
            rewardsRemainder = rewardsRemainder.add(denominator - remainder, "remainder overflow");
            result += 1;
        }
        claimedRewardsPerStake[to] = result;
        if (hasHook) {
            TrueCoinReceiver(to).tokenFallback(_from, _value);
        }
    }

    /**
     * @dev Overrides from ValTokenWithHook
     * At award time, award is not distributed to pending withdrawals
     * At deposit time, pending withdrawals are remembered to calculate stake per deposit
     * At slash time, pending withdrawals are slashed
     * So, pending withdrawals are quantified in stake
     * Pending withdrawals reduce both
     * Only KYC approved accounts can claim rewards
     * Called by initUnstake to burn and modify total supply
     * We use totalSupply to calculate rewards
     */
    function _burn(address _from, uint256 _value) internal returns (uint256 resultBalance_, uint256 resultSupply_) {
        (resultBalance_, resultSupply_) = super._burn(_from, _value);
        uint256 userClaimedRewardsPerStake = claimedRewardsPerStake[_from];
        uint256 totalRewardsPerStake = cumulativeRewardsPerStake;
        uint256 pendingRewards = (totalRewardsPerStake - userClaimedRewardsPerStake) * _value;
        if (resultBalance_ == 0) {
            // pay out the unclaimed rewards to the pool
            _award(pendingRewards);
        } else {
            // merge unclaimed rewards with remaining balance
            // in the case this goes negative, award remainder to pool
            uint256 pendingRewardsPerStake = pendingRewards / resultBalance_;
            uint256 award_ = pendingRewards % resultBalance_;
            if (pendingRewardsPerStake > userClaimedRewardsPerStake) {
                claimedRewardsPerStake[_from] = 0;
                _award(award_.add((pendingRewardsPerStake - userClaimedRewardsPerStake).mul(resultBalance_, "award overflow"), "award overflow?"));
            } else {
                claimedRewardsPerStake[_from] = userClaimedRewardsPerStake - pendingRewardsPerStake;
                _award(award_);
            }
        }
    }

    /**
     * @dev Overrides from ValTokenWithHook
     * Checks rewards remainder of recipient of mint
     */
    function _mint(address _to, uint256 _value) internal {
        emit Transfer(address(0), _to, _value);
        emit Mint(_to, _value);
        (address to, bool hook) = _resolveRecipient(_to);
        if (_to != to) {
            emit Transfer(_to, to, _value);
        }
        uint256 priorBalance = _addBalance(to, _value);
        uint256 numerator = (cumulativeRewardsPerStake * _value + claimedRewardsPerStake[_to] * priorBalance);
        uint256 denominator = (priorBalance + _value);
        uint256 result = numerator / denominator;
        uint256 remainder = numerator % denominator;
        if (remainder > 0) {
            rewardsRemainder = rewardsRemainder.add(denominator - remainder, "remainder overflow");
            result += 1;
        }
        claimedRewardsPerStake[_to] = result;
        totalSupply = totalSupply.add(_value, "totalSupply overflow");
        if (hook) {
            TrueCoinReceiver(to).tokenFallback(address(0x0), _value);
        }
    }

    /**
     * Called when this contract recieves stake. Called by token fallback.
     * Issue stake to _staker according to _amount
     * Invoked after _amount is deposited in this contract
    */
    function _deposit(address _staker, uint256 _amount) internal {
        uint256 balance = stakeAsset().balanceOf(address(this));
        uint256 stakeAmount;
        if (_amount < balance) {
            stakeAmount = _amount.mul(totalSupply.add(stakePendingWithdrawal, "stakePendingWithdrawal > totalSupply"), "overflow").div(balance - _amount, "insufficient deposit");
        } else {
            // first staker
            require(totalSupply == 0, "pool drained");
            stakeAmount = _amount * DEFAULT_RATIO;
        }
        _mint(_staker, stakeAmount);
    }

    /**
     * @dev If is reward asset, reward pool.
     * If stake asset, deposit.
     * Single staking token model. Can't stake TUSD for TUSD.
     */
    function tokenFallback(address _originalSender, uint256 _amount) external {
        if (msg.sender == address(stakeAsset())) {
            if (_originalSender == liquidator()) {
                // do not credit the liquidator
                return;
            }
            _deposit(_originalSender, _amount);
        } else if (msg.sender == address(rewardAsset())) {
            _award(_amount);
        } else {
            revert("Wrong token");
        }
    }

    /**
     * @dev Deposit stake into the pool.
     * @param _amount amount to deposit.
     */
    function deposit(uint256 _amount) external {
        require(stakeAsset().transferFrom(msg.sender, address(this), _amount));
    }

    /**
     * @dev Initialize unstake. Can specify a portion of your balance to unstake.
     * @param _maxAmount max amount caller wishes to unstake (in this.balanceOf units)
     * @return unstake_
    */
    function initUnstake(uint256 _maxAmount) external returns (uint256 unstake_) {
        unstake_ = balanceOf[msg.sender];
        if (unstake_ > _maxAmount) {
            unstake_ = _maxAmount;
        }
        _burn(msg.sender, unstake_); // burn tokens

        // add to stake pending withdrawals and account pending withdrawals
        stakePendingWithdrawal = stakePendingWithdrawal.add(unstake_, "stakePendingWithdrawal overflow");
        pendingWithdrawals[msg.sender][now] = pendingWithdrawals[msg.sender][now].add(unstake_, "pendingWithdrawals overflow");
        emit PendingWithdrawal(msg.sender, now, unstake_);
    }

    /**
     * @dev Finalize unstake after 2 weeks.
     * Loop over timestamps
     * Checks if unstake perioud has passed, if yes, calculate how much stake account get
     * @param recipient recipient of
     * @param _timestamps timestamps to
     */
    function finalizeUnstake(address recipient, uint256[] calldata _timestamps) external {
        uint256 totalUnstake = 0;
        // loop through timestamps and calculate total unstake
        for (uint256 i = _timestamps.length; i --> 0;) {
            uint256 timestamp = _timestamps[i];
            require(timestamp + UNSTAKE_PERIOD <= now, "must wait 2 weeks to unstake");
            // add to total unstake amount
            totalUnstake = totalUnstake.add(pendingWithdrawals[msg.sender][timestamp], "stake overflow");

            pendingWithdrawals[msg.sender][timestamp] = 0;
        }
        IERC20 stake = stakeAsset(); // get stake asset
        uint256 totalStake = stake.balanceOf(address(this)); // get total stake

        // calulate correstponding stake
        // consider stake pending withdrawal and total supply of stake token
        // totalUnstake / totalSupply = correspondingStake / totalStake
        // totalUnstake * totalStake / totalSupply = correspondingStake
        uint256 correspondingStake = totalStake.mul(totalUnstake, "totalStake*totalUnstake overflow").div(totalSupply.add(stakePendingWithdrawal, "overflow totalSupply+stakePendingWithdrawal"), "zero totals");
        stakePendingWithdrawal = stakePendingWithdrawal.sub(totalUnstake, "stakePendingWithdrawal underflow");
        stake.transfer(recipient, correspondingStake);
    }

    /**
     * @dev Transfer awards to the staking pool
     * @param _amount of rewardAsset to award
     */
    function award(uint256 _amount) external {
        require(rewardAsset().transferFrom(msg.sender, address(this), _amount));
    }

    /**
     * @dev Award stakig pool.
     * @param _amount amount of rewardAsset to reward
     */
    function _award(uint256 _amount) internal {
        uint256 remainder = rewardsRemainder.add(_amount, "rewards overflow");
        uint256 totalStake = totalSupply;
        if (totalStake > 0) {
            uint256 rewardsAdded = remainder / totalStake;
            rewardsRemainder = remainder % totalStake;
            cumulativeRewardsPerStake = cumulativeRewardsPerStake.add(rewardsAdded, "cumulative rewards overflow");
        } else {
            rewardsRemainder = remainder;
        }
    }

    /**
     * @dev Claim rewards and send to a destination.
     * Fails if sender account is not KYC.
     * KYC flag doesn't have to be synced to the registry.
     * @param _destination withdraw destination
     */
    function claimRewards(address _destination) external {
        // check KYC attribte
        require(attributes[uint144(uint160(msg.sender) >> 20)] & ACCOUNT_KYC != 0 || registry().getAttributeValue(msg.sender, PASSED_KYCAML) != 0, "please register at app.trusttoken.com");

        // calculate how much stake and rewards account has
        uint256 stake = balanceOf[msg.sender];
        if (stake == 0) {
            return;
        }
        uint256 dueRewards = stake.mul(cumulativeRewardsPerStake.sub(claimedRewardsPerStake[msg.sender], "underflow"), "dueRewards overflow");
        if (dueRewards == 0) {
            return;
        }
        claimedRewardsPerStake[msg.sender] = cumulativeRewardsPerStake;

        // decimals are 3 more than stake asset decimals
        require(rewardAsset().transfer(_destination, dueRewards));
    }

    function decimals() public view returns (uint8) {
        return stakeAsset().decimals() + 3;
    }

    function name() public view returns (string memory) {
        return string(abi.encodePacked(stakeAsset().name(), " staked for ", rewardAsset().name()));
    }

    function symbol() public view returns (string memory) {
        return string(abi.encodePacked(stakeAsset().symbol(), ":", rewardAsset().symbol()));
    }
}

// File: @trusttoken/trusttokens/contracts/StakedToken.sol

pragma solidity 0.5.13;





/**
 * @title StakedToken
 * @dev Implementation of AStakedToken
**/
contract StakedToken is AStakedToken {
    StakingAsset stakeAsset_;
    StakingAsset rewardAsset_;
    Registry registry_;
    address liquidator_;

    /**
     * @dev configure this contract
     */
    function configure(
        StakingAsset _stakeAsset,
        StakingAsset _rewardAsset,
        Registry _registry,
        address _liquidator
    ) external {
        require(!initalized, "already initalized StakedToken");
        stakeAsset_ = _stakeAsset;
        rewardAsset_ = _rewardAsset;
        registry_ = _registry;
        liquidator_ = _liquidator;
        initialize();
        initalized = true;
    }

    function stakeAsset() internal view returns (StakingAsset) {
        return stakeAsset_;
    }

    function rewardAsset() internal view returns (StakingAsset) {
        return rewardAsset_;
    }

    function registry() internal view returns (Registry) {
        return registry_;
    }

    function liquidator() internal view returns (address) {
        return liquidator_;
    }
}

// File: contracts/TrueCurrencies/AssuredFinancialOpportunityStorage.sol

pragma solidity 0.5.13;

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

// File: contracts/TrueReward/utilities/FractionalExponents.sol

/**
 * FractionalExponents
 * Copied and modified from:
 *  https://github.com/bancorprotocol/contracts/blob/master/solidity/contracts/converter/BancorFormula.sol#L289
 * Redistributed Under Apache License 2.0:
 *  https://github.com/bancorprotocol/contracts/blob/master/LICENSE
 * Provided as an answer to:
 *  https://ethereum.stackexchange.com/questions/50527/is-there-any-efficient-way-to-compute-the-exponentiation-of-an-fractional-base-a
 */

pragma solidity 0.5.13;

contract FractionalExponents  {

    uint256 private constant ONE = 1;
    uint32 private constant MAX_WEIGHT = 1000000;
    uint8 private constant MIN_PRECISION = 32;
    uint8 private constant MAX_PRECISION = 127;

    uint256 private constant FIXED_1 = 0x080000000000000000000000000000000;
    uint256 private constant FIXED_2 = 0x100000000000000000000000000000000;
    uint256 private constant MAX_NUM = 0x200000000000000000000000000000000;

    uint256 private constant LN2_NUMERATOR   = 0x3f80fe03f80fe03f80fe03f80fe03f8;
    uint256 private constant LN2_DENOMINATOR = 0x5b9de1d10bf4103d647b0955897ba80;

    uint256 private constant OPT_LOG_MAX_VAL = 0x15bf0a8b1457695355fb8ac404e7a79e3;
    uint256 private constant OPT_EXP_MAX_VAL = 0x800000000000000000000000000000000;

    uint256[128] private maxExpArray;
    function BancorFormula() public {
        maxExpArray[32] = 0x1c35fedd14ffffffffffffffffffffffff;
        maxExpArray[33] = 0x1b0ce43b323fffffffffffffffffffffff;
        maxExpArray[34] = 0x19f0028ec1ffffffffffffffffffffffff;
        maxExpArray[35] = 0x18ded91f0e7fffffffffffffffffffffff;
        maxExpArray[36] = 0x17d8ec7f0417ffffffffffffffffffffff;
        maxExpArray[37] = 0x16ddc6556cdbffffffffffffffffffffff;
        maxExpArray[38] = 0x15ecf52776a1ffffffffffffffffffffff;
        maxExpArray[39] = 0x15060c256cb2ffffffffffffffffffffff;
        maxExpArray[40] = 0x1428a2f98d72ffffffffffffffffffffff;
        maxExpArray[41] = 0x13545598e5c23fffffffffffffffffffff;
        maxExpArray[42] = 0x1288c4161ce1dfffffffffffffffffffff;
        maxExpArray[43] = 0x11c592761c666fffffffffffffffffffff;
        maxExpArray[44] = 0x110a688680a757ffffffffffffffffffff;
        maxExpArray[45] = 0x1056f1b5bedf77ffffffffffffffffffff;
        maxExpArray[46] = 0x0faadceceeff8bffffffffffffffffffff;
        maxExpArray[47] = 0x0f05dc6b27edadffffffffffffffffffff;
        maxExpArray[48] = 0x0e67a5a25da4107fffffffffffffffffff;
        maxExpArray[49] = 0x0dcff115b14eedffffffffffffffffffff;
        maxExpArray[50] = 0x0d3e7a392431239fffffffffffffffffff;
        maxExpArray[51] = 0x0cb2ff529eb71e4fffffffffffffffffff;
        maxExpArray[52] = 0x0c2d415c3db974afffffffffffffffffff;
        maxExpArray[53] = 0x0bad03e7d883f69bffffffffffffffffff;
        maxExpArray[54] = 0x0b320d03b2c343d5ffffffffffffffffff;
        maxExpArray[55] = 0x0abc25204e02828dffffffffffffffffff;
        maxExpArray[56] = 0x0a4b16f74ee4bb207fffffffffffffffff;
        maxExpArray[57] = 0x09deaf736ac1f569ffffffffffffffffff;
        maxExpArray[58] = 0x0976bd9952c7aa957fffffffffffffffff;
        maxExpArray[59] = 0x09131271922eaa606fffffffffffffffff;
        maxExpArray[60] = 0x08b380f3558668c46fffffffffffffffff;
        maxExpArray[61] = 0x0857ddf0117efa215bffffffffffffffff;
        maxExpArray[62] = 0x07ffffffffffffffffffffffffffffffff;
        maxExpArray[63] = 0x07abbf6f6abb9d087fffffffffffffffff;
        maxExpArray[64] = 0x075af62cbac95f7dfa7fffffffffffffff;
        maxExpArray[65] = 0x070d7fb7452e187ac13fffffffffffffff;
        maxExpArray[66] = 0x06c3390ecc8af379295fffffffffffffff;
        maxExpArray[67] = 0x067c00a3b07ffc01fd6fffffffffffffff;
        maxExpArray[68] = 0x0637b647c39cbb9d3d27ffffffffffffff;
        maxExpArray[69] = 0x05f63b1fc104dbd39587ffffffffffffff;
        maxExpArray[70] = 0x05b771955b36e12f7235ffffffffffffff;
        maxExpArray[71] = 0x057b3d49dda84556d6f6ffffffffffffff;
        maxExpArray[72] = 0x054183095b2c8ececf30ffffffffffffff;
        maxExpArray[73] = 0x050a28be635ca2b888f77fffffffffffff;
        maxExpArray[74] = 0x04d5156639708c9db33c3fffffffffffff;
        maxExpArray[75] = 0x04a23105873875bd52dfdfffffffffffff;
        maxExpArray[76] = 0x0471649d87199aa990756fffffffffffff;
        maxExpArray[77] = 0x04429a21a029d4c1457cfbffffffffffff;
        maxExpArray[78] = 0x0415bc6d6fb7dd71af2cb3ffffffffffff;
        maxExpArray[79] = 0x03eab73b3bbfe282243ce1ffffffffffff;
        maxExpArray[80] = 0x03c1771ac9fb6b4c18e229ffffffffffff;
        maxExpArray[81] = 0x0399e96897690418f785257fffffffffff;
        maxExpArray[82] = 0x0373fc456c53bb779bf0ea9fffffffffff;
        maxExpArray[83] = 0x034f9e8e490c48e67e6ab8bfffffffffff;
        maxExpArray[84] = 0x032cbfd4a7adc790560b3337ffffffffff;
        maxExpArray[85] = 0x030b50570f6e5d2acca94613ffffffffff;
        maxExpArray[86] = 0x02eb40f9f620fda6b56c2861ffffffffff;
        maxExpArray[87] = 0x02cc8340ecb0d0f520a6af58ffffffffff;
        maxExpArray[88] = 0x02af09481380a0a35cf1ba02ffffffffff;
        maxExpArray[89] = 0x0292c5bdd3b92ec810287b1b3fffffffff;
        maxExpArray[90] = 0x0277abdcdab07d5a77ac6d6b9fffffffff;
        maxExpArray[91] = 0x025daf6654b1eaa55fd64df5efffffffff;
        maxExpArray[92] = 0x0244c49c648baa98192dce88b7ffffffff;
        maxExpArray[93] = 0x022ce03cd5619a311b2471268bffffffff;
        maxExpArray[94] = 0x0215f77c045fbe885654a44a0fffffffff;
        maxExpArray[95] = 0x01ffffffffffffffffffffffffffffffff;
        maxExpArray[96] = 0x01eaefdbdaaee7421fc4d3ede5ffffffff;
        maxExpArray[97] = 0x01d6bd8b2eb257df7e8ca57b09bfffffff;
        maxExpArray[98] = 0x01c35fedd14b861eb0443f7f133fffffff;
        maxExpArray[99] = 0x01b0ce43b322bcde4a56e8ada5afffffff;
        maxExpArray[100] = 0x019f0028ec1fff007f5a195a39dfffffff;
        maxExpArray[101] = 0x018ded91f0e72ee74f49b15ba527ffffff;
        maxExpArray[102] = 0x017d8ec7f04136f4e5615fd41a63ffffff;
        maxExpArray[103] = 0x016ddc6556cdb84bdc8d12d22e6fffffff;
        maxExpArray[104] = 0x015ecf52776a1155b5bd8395814f7fffff;
        maxExpArray[105] = 0x015060c256cb23b3b3cc3754cf40ffffff;
        maxExpArray[106] = 0x01428a2f98d728ae223ddab715be3fffff;
        maxExpArray[107] = 0x013545598e5c23276ccf0ede68034fffff;
        maxExpArray[108] = 0x01288c4161ce1d6f54b7f61081194fffff;
        maxExpArray[109] = 0x011c592761c666aa641d5a01a40f17ffff;
        maxExpArray[110] = 0x0110a688680a7530515f3e6e6cfdcdffff;
        maxExpArray[111] = 0x01056f1b5bedf75c6bcb2ce8aed428ffff;
        maxExpArray[112] = 0x00faadceceeff8a0890f3875f008277fff;
        maxExpArray[113] = 0x00f05dc6b27edad306388a600f6ba0bfff;
        maxExpArray[114] = 0x00e67a5a25da41063de1495d5b18cdbfff;
        maxExpArray[115] = 0x00dcff115b14eedde6fc3aa5353f2e4fff;
        maxExpArray[116] = 0x00d3e7a3924312399f9aae2e0f868f8fff;
        maxExpArray[117] = 0x00cb2ff529eb71e41582cccd5a1ee26fff;
        maxExpArray[118] = 0x00c2d415c3db974ab32a51840c0b67edff;
        maxExpArray[119] = 0x00bad03e7d883f69ad5b0a186184e06bff;
        maxExpArray[120] = 0x00b320d03b2c343d4829abd6075f0cc5ff;
        maxExpArray[121] = 0x00abc25204e02828d73c6e80bcdb1a95bf;
        maxExpArray[122] = 0x00a4b16f74ee4bb2040a1ec6c15fbbf2df;
        maxExpArray[123] = 0x009deaf736ac1f569deb1b5ae3f36c130f;
        maxExpArray[124] = 0x00976bd9952c7aa957f5937d790ef65037;
        maxExpArray[125] = 0x009131271922eaa6064b73a22d0bd4f2bf;
        maxExpArray[126] = 0x008b380f3558668c46c91c49a2f8e967b9;
        maxExpArray[127] = 0x00857ddf0117efa215952912839f6473e6;
    }



    /**
        General Description:
            Determine a value of precision.
            Calculate an integer approximation of (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision.
            Return the result along with the precision used.

        Detailed Description:
            Instead of calculating "base ^ exp", we calculate "e ^ (log(base) * exp)".
            The value of "log(base)" is represented with an integer slightly smaller than "log(base) * 2 ^ precision".
            The larger "precision" is, the more accurately this value represents the real value.
            However, the larger "precision" is, the more bits are required in order to store this value.
            And the exponentiation function, which takes "x" and calculates "e ^ x", is limited to a maximum exponent (maximum value of "x").
            This maximum exponent depends on the "precision" used, and it is given by "maxExpArray[precision] >> (MAX_PRECISION - precision)".
            Hence we need to determine the highest precision which can be used for the given input, before calling the exponentiation function.
            This allows us to compute "base ^ exp" with maximum accuracy and without exceeding 256 bits in any of the intermediate computations.
            This functions assumes that "_expN < 2 ^ 256 / log(MAX_NUM - 1)", otherwise the multiplication should be replaced with a "safeMul".
    */
    function power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) public view returns (uint256, uint8) {
        assert(_baseN < MAX_NUM);

        uint256 baseLog;
        uint256 base = _baseN * FIXED_1 / _baseD;
        if (base < OPT_LOG_MAX_VAL) {
            baseLog = optimalLog(base);
        }
        else {
            baseLog = generalLog(base);
        }

        uint256 baseLogTimesExp = baseLog * _expN / _expD;
        if (baseLogTimesExp < OPT_EXP_MAX_VAL) {
            return (optimalExp(baseLogTimesExp), MAX_PRECISION);
        }
        else {
            uint8 precision = findPositionInMaxExpArray(baseLogTimesExp);
            return (generalExp(baseLogTimesExp >> (MAX_PRECISION - precision), precision), precision);
        }
    }

    /**
        Compute log(x / FIXED_1) * FIXED_1.
        This functions assumes that "x >= FIXED_1", because the output would be negative otherwise.
    */
    function generalLog(uint256 x) internal pure returns (uint256) {
        uint256 res = 0;

        // If x >= 2, then we compute the integer part of log2(x), which is larger than 0.
        if (x >= FIXED_2) {
            uint8 count = floorLog2(x / FIXED_1);
            x >>= count; // now x < 2
            res = count * FIXED_1;
        }

        // If x > 1, then we compute the fraction part of log2(x), which is larger than 0.
        if (x > FIXED_1) {
            for (uint8 i = MAX_PRECISION; i > 0; --i) {
                x = (x * x) / FIXED_1; // now 1 < x < 4
                if (x >= FIXED_2) {
                    x >>= 1; // now 1 < x < 2
                    res += ONE << (i - 1);
                }
            }
        }

        return res * LN2_NUMERATOR / LN2_DENOMINATOR;
    }

    /**
        Compute the largest integer smaller than or equal to the binary logarithm of the input.
    */
    function floorLog2(uint256 _n) internal pure returns (uint8) {
        uint8 res = 0;

        if (_n < 256) {
            // At most 8 iterations
            while (_n > 1) {
                _n >>= 1;
                res += 1;
            }
        }
        else {
            // Exactly 8 iterations
            for (uint8 s = 128; s > 0; s >>= 1) {
                if (_n >= (ONE << s)) {
                    _n >>= s;
                    res |= s;
                }
            }
        }

        return res;
    }

    /**
        The global "maxExpArray" is sorted in descending order, and therefore the following statements are equivalent:
        - This function finds the position of [the smallest value in "maxExpArray" larger than or equal to "x"]
        - This function finds the highest position of [a value in "maxExpArray" larger than or equal to "x"]
    */
    function findPositionInMaxExpArray(uint256 _x) internal view returns (uint8) {
        uint8 lo = MIN_PRECISION;
        uint8 hi = MAX_PRECISION;

        while (lo + 1 < hi) {
            uint8 mid = (lo + hi) / 2;
            if (maxExpArray[mid] >= _x)
                lo = mid;
            else
                hi = mid;
        }

        if (maxExpArray[hi] >= _x)
            return hi;
        if (maxExpArray[lo] >= _x)
            return lo;

        assert(false);
        return 0;
    }

    /**
        This function can be auto-generated by the script 'PrintFunctionGeneralExp.py'.
        It approximates "e ^ x" via maclaurin summation: "(x^0)/0! + (x^1)/1! + ... + (x^n)/n!".
        It returns "e ^ (x / 2 ^ precision) * 2 ^ precision", that is, the result is upshifted for accuracy.
        The global "maxExpArray" maps each "precision" to "((maximumExponent + 1) << (MAX_PRECISION - precision)) - 1".
        The maximum permitted value for "x" is therefore given by "maxExpArray[precision] >> (MAX_PRECISION - precision)".
    */
    function generalExp(uint256 _x, uint8 _precision) internal pure returns (uint256) {
        uint256 xi = _x;
        uint256 res = 0;

        xi = (xi * _x) >> _precision;
        res += xi * 0x3442c4e6074a82f1797f72ac0000000; // add x^02 * (33! / 02!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x116b96f757c380fb287fd0e40000000; // add x^03 * (33! / 03!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x045ae5bdd5f0e03eca1ff4390000000; // add x^04 * (33! / 04!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00defabf91302cd95b9ffda50000000; // add x^05 * (33! / 05!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x002529ca9832b22439efff9b8000000; // add x^06 * (33! / 06!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00054f1cf12bd04e516b6da88000000; // add x^07 * (33! / 07!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000a9e39e257a09ca2d6db51000000; // add x^08 * (33! / 08!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x000012e066e7b839fa050c309000000; // add x^09 * (33! / 09!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x000001e33d7d926c329a1ad1a800000; // add x^10 * (33! / 10!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000002bee513bdb4a6b19b5f800000; // add x^11 * (33! / 11!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00000003a9316fa79b88eccf2a00000; // add x^12 * (33! / 12!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000048177ebe1fa812375200000; // add x^13 * (33! / 13!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000005263fe90242dcbacf00000; // add x^14 * (33! / 14!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x000000000057e22099c030d94100000; // add x^15 * (33! / 15!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000000057e22099c030d9410000; // add x^16 * (33! / 16!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00000000000052b6b54569976310000; // add x^17 * (33! / 17!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00000000000004985f67696bf748000; // add x^18 * (33! / 18!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x000000000000003dea12ea99e498000; // add x^19 * (33! / 19!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00000000000000031880f2214b6e000; // add x^20 * (33! / 20!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x000000000000000025bcff56eb36000; // add x^21 * (33! / 21!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x000000000000000001b722e10ab1000; // add x^22 * (33! / 22!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000000000000001317c70077000; // add x^23 * (33! / 23!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00000000000000000000cba84aafa00; // add x^24 * (33! / 24!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00000000000000000000082573a0a00; // add x^25 * (33! / 25!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00000000000000000000005035ad900; // add x^26 * (33! / 26!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x000000000000000000000002f881b00; // add x^27 * (33! / 27!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000000000000000000001b29340; // add x^28 * (33! / 28!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x00000000000000000000000000efc40; // add x^29 * (33! / 29!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000000000000000000000007fe0; // add x^30 * (33! / 30!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000000000000000000000000420; // add x^31 * (33! / 31!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000000000000000000000000021; // add x^32 * (33! / 32!)

        xi = (xi * _x) >> _precision;
        res += xi * 0x0000000000000000000000000000001; // add x^33 * (33! / 33!)


        return res / 0x688589cc0e9505e2f2fee5580000000 + _x + (ONE << _precision); // divide by 33! and then add x^1 / 1! + x^0 / 0!
    }

    /**
        Return log(x / FIXED_1) * FIXED_1
        Input range: FIXED_1 <= x <= LOG_EXP_MAX_VAL - 1
    */
    function optimalLog(uint256 x) internal pure returns (uint256) {
        uint256 res = 0;

        uint256 y;
        uint256 z;
        uint256 w;

        if (x >= 0xd3094c70f034de4b96ff7d5b6f99fcd8) {
            res += 0x40000000000000000000000000000000;
            x = x * FIXED_1 / 0xd3094c70f034de4b96ff7d5b6f99fcd8;
        }

        if (x >= 0xa45af1e1f40c333b3de1db4dd55f29a7) {
            res += 0x20000000000000000000000000000000;
            x = x * FIXED_1 / 0xa45af1e1f40c333b3de1db4dd55f29a7;
        }

        if (x >= 0x910b022db7ae67ce76b441c27035c6a1) {
            res += 0x10000000000000000000000000000000;
            x = x * FIXED_1 / 0x910b022db7ae67ce76b441c27035c6a1;
        }

        if (x >= 0x88415abbe9a76bead8d00cf112e4d4a8) {
            res += 0x08000000000000000000000000000000;
            x = x * FIXED_1 / 0x88415abbe9a76bead8d00cf112e4d4a8;
        }

        if (x >= 0x84102b00893f64c705e841d5d4064bd3) {
            res += 0x04000000000000000000000000000000;
            x = x * FIXED_1 / 0x84102b00893f64c705e841d5d4064bd3;
        }

        if (x >= 0x8204055aaef1c8bd5c3259f4822735a2) {
            res += 0x02000000000000000000000000000000;
            x = x * FIXED_1 / 0x8204055aaef1c8bd5c3259f4822735a2;
        }

        if (x >= 0x810100ab00222d861931c15e39b44e99) {
            res += 0x01000000000000000000000000000000;
            x = x * FIXED_1 / 0x810100ab00222d861931c15e39b44e99;
        }

        if (x >= 0x808040155aabbbe9451521693554f733) {
            res += 0x00800000000000000000000000000000;
            x = x * FIXED_1 / 0x808040155aabbbe9451521693554f733;
        }

        z = y = x - FIXED_1;
        w = y * y / FIXED_1;

        res += z * (0x100000000000000000000000000000000 - y) / 0x100000000000000000000000000000000;
        z = z * w / FIXED_1;

        res += z * (0x0aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa - y) / 0x200000000000000000000000000000000;
        z = z * w / FIXED_1;

        res += z * (0x099999999999999999999999999999999 - y) / 0x300000000000000000000000000000000;
        z = z * w / FIXED_1;

        res += z * (0x092492492492492492492492492492492 - y) / 0x400000000000000000000000000000000;
        z = z * w / FIXED_1;

        res += z * (0x08e38e38e38e38e38e38e38e38e38e38e - y) / 0x500000000000000000000000000000000;
        z = z * w / FIXED_1;

        res += z * (0x08ba2e8ba2e8ba2e8ba2e8ba2e8ba2e8b - y) / 0x600000000000000000000000000000000;
        z = z * w / FIXED_1;

        res += z * (0x089d89d89d89d89d89d89d89d89d89d89 - y) / 0x700000000000000000000000000000000;
        z = z * w / FIXED_1;

        res += z * (0x088888888888888888888888888888888 - y) / 0x800000000000000000000000000000000;

        return res;
    }

    /**
        Return e ^ (x / FIXED_1) * FIXED_1
        Input range: 0 <= x <= OPT_EXP_MAX_VAL - 1
    */
    function optimalExp(uint256 x) internal pure returns (uint256) {
        uint256 res = 0;

        uint256 y;
        uint256 z;

        z = y = x % 0x10000000000000000000000000000000;

        z = z * y / FIXED_1;
        res += z * 0x10e1b3be415a0000; // add y^02 * (20! / 02!)

        z = z * y / FIXED_1;
        res += z * 0x05a0913f6b1e0000; // add y^03 * (20! / 03!)

        z = z * y / FIXED_1;
        res += z * 0x0168244fdac78000; // add y^04 * (20! / 04!)

        z = z * y / FIXED_1;
        res += z * 0x004807432bc18000; // add y^05 * (20! / 05!)

        z = z * y / FIXED_1;
        res += z * 0x000c0135dca04000; // add y^06 * (20! / 06!)

        z = z * y / FIXED_1;
        res += z * 0x0001b707b1cdc000; // add y^07 * (20! / 07!)

        z = z * y / FIXED_1;
        res += z * 0x000036e0f639b800; // add y^08 * (20! / 08!)

        z = z * y / FIXED_1;
        res += z * 0x00000618fee9f800; // add y^09 * (20! / 09!)

        z = z * y / FIXED_1;
        res += z * 0x0000009c197dcc00; // add y^10 * (20! / 10!)

        z = z * y / FIXED_1;
        res += z * 0x0000000e30dce400; // add y^11 * (20! / 11!)

        z = z * y / FIXED_1;
        res += z * 0x000000012ebd1300; // add y^12 * (20! / 12!)

        z = z * y / FIXED_1;
        res += z * 0x0000000017499f00; // add y^13 * (20! / 13!)

        z = z * y / FIXED_1;
        res += z * 0x0000000001a9d480; // add y^14 * (20! / 14!)

        z = z * y / FIXED_1;
        res += z * 0x00000000001c6380; // add y^15 * (20! / 15!)

        z = z * y / FIXED_1;
        res += z * 0x000000000001c638; // add y^16 * (20! / 16!)

        z = z * y / FIXED_1;
        res += z * 0x0000000000001ab8; // add y^17 * (20! / 17!)

        z = z * y / FIXED_1;
        res += z * 0x000000000000017c; // add y^18 * (20! / 18!)

        z = z * y / FIXED_1;
        res += z * 0x0000000000000014; // add y^19 * (20! / 19!)

        z = z * y / FIXED_1;
        res += z * 0x0000000000000001; // add y^20 * (20! / 20!)

        res = res / 0x21c3677c82b40000 + y + FIXED_1; // divide by 20! and then add y^1 / 1! + y^0 / 0!

        if ((x & 0x010000000000000000000000000000000) != 0) {
            res = res * 0x1c3d6a24ed82218787d624d3e5eba95f9 / 0x18ebef9eac820ae8682b9793ac6d1e776;
        }

        if ((x & 0x020000000000000000000000000000000) != 0) {
            res = res * 0x18ebef9eac820ae8682b9793ac6d1e778 / 0x1368b2fc6f9609fe7aceb46aa619baed4;
        }

        if ((x & 0x040000000000000000000000000000000) != 0) {
            res = res * 0x1368b2fc6f9609fe7aceb46aa619baed5 / 0x0bc5ab1b16779be3575bd8f0520a9f21f;
        }

        if ((x & 0x080000000000000000000000000000000) != 0) {
            res = res * 0x0bc5ab1b16779be3575bd8f0520a9f21e / 0x0454aaa8efe072e7f6ddbab84b40a55c9;
        }

        if ((x & 0x100000000000000000000000000000000) != 0) {
            res = res * 0x0454aaa8efe072e7f6ddbab84b40a55c5 / 0x00960aadc109e7a3bf4578099615711ea;
        }

        if ((x & 0x200000000000000000000000000000000) != 0) {
            res = res * 0x00960aadc109e7a3bf4578099615711d7 / 0x0002bf84208204f5977f9a8cf01fdce3d;
        }

        if ((x & 0x400000000000000000000000000000000) != 0) {
            res = res * 0x0002bf84208204f5977f9a8cf01fdc307 / 0x0000003c6ab775dd0b95b4cbee7e65d11;
        }

        return res;
    }
}

// File: contracts/TrueReward/AssuredFinancialOpportunity.sol

pragma solidity 0.5.13;











/**
 * @title AssuredFinancialOpportunity
 * @dev Wrap financial opportunity with Assurance
 *
 * -- Overview --
 * Rewards are earned as tokenValue() increases in the underlying opportunity
 * TUSD is never held in this contract - zTUSD represents value we owe to depositors
 *
 * -- zTUSD vs yTUSD --
 * zTUSD represents an amount of ASSURED TUSD owed to the zTUSD holder (depositors)
 * 1 zTUSD = (yTUSD ^ assurance ratio)
 * yTUSD represents an amount of NON-ASSURED TUSD owed to this contract
 * TUSD value = yTUSD * finOp.tokenValue()
 *
 * -- Awarding the Assurance Pool
 * The difference increases when depositors withdraw
 * Pool award is calculated as follows
 * (finOpValue * finOpBalance) - (assuredOpportunityBalance * assuredOpportunityTokenValue)
 *
 * -- Flash Assurance --
 * If a transfer fails, stake is sold from the assurance pool for TUSD
 * When stake is liquidated, the TUSD is sent out in the same transaction
 * Can attempt to sell bad debt at a later date and return value to the pool
 *
 * -- Assumptions --
 * tokenValue can never decrease for this contract. We want to guarantee
 * the awards earned on deposited TUSD and liquidate trusttokens for this amount
 * We allow the rewardBasis to be adjusted, but since we still need to maintain
 * the tokenValue, we calculate an adjustment factor and set minTokenValue
 *
**/
contract AssuredFinancialOpportunity is FinancialOpportunity, AssuredFinancialOpportunityStorage, InitializableClaimable {
    using SafeMath for uint256;
    using SafeMath for uint256;

    // tolerance of rounding errors
    uint8 constant TOLERANCE = 100;
    // total basis points for pool awards
    uint32 constant TOTAL_BASIS = 1000;

    // external contracts
    address finOpAddress;
    address assuranceAddress;
    address liquidatorAddress;
    address exponentContractAddress;
    address trueRewardBackedTokenAddress;

    // address allowed to withdraw/deposit, usually set to address of TUSD smart contract
    address fundsManager;

    event Deposit(address indexed account, uint256 tusd, uint256 ztusd);
    event Redemption(address indexed to, uint256 ztusd, uint256 tusd);
    event Liquidation(address indexed receiver, int256 debt);
    event AwardPool(uint256 amount);
    event AwardFailure(uint256 amount);

    /// funds manager can deposit/withdraw from this opportunity
    modifier onlyFundsManager() {
        require(msg.sender == fundsManager, "only funds manager");
        _;
    }
    /**
     * @dev configure assured opportunity
     */
    function configure(
        address _finOpAddress,                  // finOp to assure
        address _assuranceAddress,              // assurance pool
        address _liquidatorAddress,             // trusttoken liqudiator
        address _exponentContractAddress,       // exponent contract
        address _trueRewardBackedTokenAddress,  // token
        address _fundsManager                   // funds manager
    ) external {
        require(_finOpAddress != address(0), "finOp cannot be address(0)");
        require(_assuranceAddress != address(0), "assurance pool cannot be address(0)");
        require(_liquidatorAddress != address(0), "liquidator cannot be address(0)");
        require(_exponentContractAddress != address(0), "exponent cannot be address(0)");
        require(_trueRewardBackedTokenAddress != address(0), "token cannot be address(0)");
        require(_fundsManager != address(0), "findsManager cannot be address(0)");
        super._configure(); // sender claims ownership here
        finOpAddress = _finOpAddress;
        assuranceAddress = _assuranceAddress;
        liquidatorAddress = _liquidatorAddress;
        exponentContractAddress = _exponentContractAddress;
        trueRewardBackedTokenAddress = _trueRewardBackedTokenAddress;
        fundsManager = _fundsManager;
        // only update factors if they are zero (default)
        if (adjustmentFactor == 0) {
            adjustmentFactor = 1*10**18;
        }
        if (rewardBasis == 0) {
            rewardBasis = TOTAL_BASIS; // set to 100% by default
        }
    }

    /**
     * @dev total supply of zTUSD
     * inherited from FinancialOpportunity.sol
     */
    function totalSupply() external view returns (uint256) {
        return zTUSDIssued;
    }

    /**
     * @dev value of TUSD per zTUSD
     * inherited from FinancialOpportunity.sol
     *
     * @return TUSD value of zTUSD
     */
    function tokenValue() external view returns(uint256) {
        return _tokenValue();
    }

    /**
     * @dev deposit TUSD for zTUSD
     * inherited from FinancialOpportunity.sol
     *
     * @param from address to deposit from
     * @param amount TUSD amount to deposit
     * @return zTUSD amount
     */
    function deposit(address from, uint256 amount) external onlyFundsManager returns(uint256) {
        return _deposit(from, amount);
    }

    /**
     * @dev redeem zTUSD for TUSD
     * inherited from FinancialOpportunity.sol
     *
     * @param to address to send tusd to
     * @param amount amount of zTUSD to redeem
     * @return amount of TUSD returned by finOp
     */
    function redeem(address to, uint256 amount) external onlyFundsManager returns(uint256) {
        return _redeem(to, amount);
    }

    /**
     * @dev Get TUSD to be awarded to staking pool
     * Calculated as the difference in value of total zTUSD and yTUSD
     * (finOpTotalSupply * finOpTokenValue) - (zTUSDIssued * zTUSDTokenValue)
     *
     * @return pool balance in TUSD
     */
    function poolAwardBalance() public view returns (uint256) {
        uint256 zTUSDValue = finOp().tokenValue().mul(finOp().totalSupply()).div(10**18);
        uint256 yTUSDValue = _totalSupply().mul(_tokenValue()).div(10**18);
        return zTUSDValue.sub(yTUSDValue);
    }

    /**
     * @dev Sell yTUSD for TUSD and deposit into staking pool.
     * Award amount is the difference between zTUSD issued an
     * yTUSD in the underlying financial opportunity
     */
    function awardPool() external {
        uint256 amount = poolAwardBalance();
        uint256 ytusd = _yTUSD(amount);

        // sell pool debt and award TUSD to pool
        (bool success, uint256 returnedAmount) = _attemptRedeem(address(this), ytusd);

        if (success) {
            token().transfer(address(pool()), returnedAmount);
            emit AwardPool(returnedAmount);
        }
        else {
            emit AwardFailure(returnedAmount);
        }
    }

    /**
     * @dev set new reward basis for opportunity
     * recalculate tokenValue and ensure tokenValue never decreases
     *
     * @param newBasis new reward basis
     */
    function setRewardBasis(uint32 newBasis) external onlyOwner {
        minTokenValue = _tokenValue();

        adjustmentFactor = adjustmentFactor
            .mul(_calculateTokenValue(rewardBasis))
            .div(_calculateTokenValue(newBasis));
        rewardBasis = newBasis;
    }

    /**
     * @dev Get supply amount of zTUSD issued
     * @return zTUSD issued
    **/
    function _totalSupply() internal view returns (uint256) {
        return zTUSDIssued;
    }

    /**
     * Calculate yTUSD / zTUSD (opportunity value minus pool award)
     * We assume opportunity tokenValue always goes up
     *
     * @return value of zTUSD
     */
    function _tokenValue() internal view returns(uint256) {
        // if no assurance, use  opportunity tokenValue
        if (rewardBasis == TOTAL_BASIS) {
            return finOp().tokenValue();
        }
        uint256 calculatedValue = _calculateTokenValue(rewardBasis).mul(adjustmentFactor).div(10**18);
        if(calculatedValue < minTokenValue) {
            return minTokenValue;
        } else {
            return calculatedValue;
        }
    }

    /**
     * @dev calculate TUSD value of zTUSD
     * zTUSD = yTUSD ^ (rewardBasis / totalBasis)
     * reward ratio = _rewardBasis / TOTAL_BASIS
     *
     * @param _rewardBasis reward basis (max TOTAL_BASIS)
     * @return zTUSD token value
     */
    function _calculateTokenValue(uint32 _rewardBasis) internal view returns(uint256) {
        (uint256 result, uint8 precision) = exponents().power(
            finOp().tokenValue(), 10**18,
            _rewardBasis, TOTAL_BASIS);
        return result.mul(10**18).div(2 ** uint256(precision));
    }

    /**
     * @dev Deposit TUSD into wrapped opportunity.
     * Calculate zTUSD value and add to issuance value.
     *
     * @param _account account to deposit tusd from
     * @param _amount amount of tusd to deposit
     */
    function _deposit(address _account, uint256 _amount) internal returns(uint256) {
        token().transferFrom(_account, address(this), _amount);

        // deposit TUSD into opportunity
        token().approve(finOpAddress, _amount);
        finOp().deposit(address(this), _amount);

        // calculate zTUSD value of deposit
        uint256 ztusd = _amount.mul(10 ** 18).div(_tokenValue());

        // update zTUSDIssued
        zTUSDIssued = zTUSDIssued.add(ztusd);
        emit Deposit(_account, _amount, ztusd);
        return ztusd;
    }

    /**
     * @dev Redeem zTUSD for TUSD
     * Liquidate if opportunity fails to return TUSD.
     *
     * @param _to address to withdraw to
     * @param ztusd amount in ytusd to redeem
     * @return TUSD amount redeemed for zTUSD
     */
    function _redeem(address _to, uint256 ztusd) internal returns(uint256) {

        // attempt withdraw to this contract
        // here we redeem ztusd amount which leaves
        // a small amount of yTUSD left in the finOp
        // which can be redeemed by the assurance pool
        (bool success, uint256 returnedAmount) = _attemptRedeem(address(this), ztusd);

        // calculate reward amount
        // todo feewet: check if expected amount is correct
        // possible use precision threshold or smart rounding
        // to eliminate micro liquidations
        uint256 expectedAmount = _tokenValue().mul(ztusd).div(10**18);
        uint256 liquidated = 0;

        if (!success || (returnedAmount.add(TOLERANCE) < expectedAmount)) {
            liquidated = _liquidate(address(this), int256(expectedAmount.sub(returnedAmount)));
        }

        zTUSDIssued = zTUSDIssued.sub(ztusd, "not enough supply");

        // transfer token to redeemer
        require(token().transfer(_to, returnedAmount.add(liquidated)), "transfer failed");

        emit Redemption(_to, ztusd, returnedAmount);
        return returnedAmount;
    }

    /**
     * @dev Try to redeem and return success and amount
     *
     * @param _to redeemer address
     * @param ztusd amount in ztusd
    **/
    function _attemptRedeem(address _to, uint256 ztusd) internal returns (bool, uint) {
        uint256 returnedAmount;

        // attempt to withdraw from opportunity
        (bool success, bytes memory returnData) = address(finOp()).call(
            abi.encodePacked(finOp().redeem.selector, abi.encode(_to, ztusd))
        );

        if (success) { // successfully got TUSD :)
            returnedAmount = abi.decode(returnData, (uint256));
        }
        else { // failed get TUSD :(
            returnedAmount = 0;
        }
        return (success, returnedAmount);
    }

    /**
     * @dev Liquidate tokens in staking pool to cover debt
     * Sends tusd to receiver
     *
     * @param _receiver address to recieve tusd
     * @param _debt tusd debt to be liquidated
     * @return amount liquidated
    **/
    function _liquidate(address _receiver, int256 _debt) internal returns (uint256) {
        liquidator().reclaim(_receiver, _debt);
        emit Liquidation(_receiver, _debt);
        return uint(_debt);
    }

    /**
     * @dev convert tusd value into yTUSD value
     * @param _tusd TUSD to convert
     * @return yTUSD value of TUSD
     */
    function _yTUSD(uint256 _tusd) internal view returns (uint256) {
        return _tusd.mul(10**18).div(finOp().tokenValue());
    }

    /**
     * @dev convert tusd value into zTUSD value
     * @param _tusd TUSD to convert
     * @return zTUSD value of TUSD
     */
    function _zTUSD(uint256 _tusd) internal view returns (uint256) {
        return _tusd.mul(10**18).div(_tokenValue());
    }

    /// @dev claim ownership of liquidator
    function claimLiquidatorOwnership() external onlyOwner {
        liquidator().claimOwnership();
    }

    /// @dev transfer ownership of liquidator
    function transferLiquidatorOwnership(address newOwner) external onlyOwner {
        liquidator().transferOwnership(newOwner);
    }

    /// @dev getter for financial opportuniry
    /// @return financial opportunity
    function finOp() public view returns(FinancialOpportunity) {
        return FinancialOpportunity(finOpAddress);
    }

    /// @dev getter for staking pool
    /// @return staking pool
    function pool() public view returns(StakedToken) {
        return StakedToken(assuranceAddress); // StakedToken is assurance staking pool
    }

    /// @dev getter for liquidator
    function liquidator() public view returns (Liquidator) {
        return Liquidator(liquidatorAddress);
    }

    /// @dev getter for exponents contract
    function exponents() public view returns (FractionalExponents){
        return FractionalExponents(exponentContractAddress);
    }

    /// @dev deposit token (TrueUSD)
    function token() public view returns (IERC20){
        return IERC20(trueRewardBackedTokenAddress);
    }

    /// @dev default payable
    function() external payable {}
}

// File: contracts/TrueReward/IAToken.sol

pragma solidity 0.5.13;


contract IAToken is IERC20 {
    function redeem(uint256 _shares) external;
}

// File: contracts/TrueReward/ILendingPool.sol

pragma solidity 0.5.13;

interface ILendingPool {
  function deposit(address _reserve, uint256 _amount, uint16 _referralCode) external;
  function core() external view returns(address);
}

// File: contracts/TrueReward/ILendingPoolCore.sol

pragma solidity 0.5.13;

interface ILendingPoolCore {
  function getReserveNormalizedIncome(address _reserve) external view returns (uint256);
  function transferToReserve(address _reserve, address payable _user, uint256 _amount) external;
}

// File: contracts/TrueReward/AaveFinancialOpportunity.sol

pragma solidity 0.5.13;









/**
 * @title AaveFinancialOpportunity
 * @dev Financial Opportunity to earn TrueUSD with Aave
 *
 * -- Overview --
 * This contract acts as an intermediary between TrueUSD and Aave
 * Tokens are pooled here and balances are kept track in TrueUSD
 * This contract is deployed behind a proxy and is owned by TrueUSD
 *
 * -- yTUSD and aTokens
 * yTUSD represents a fixed share in the financial opportunity pool
 * aTokens are Aave tokens and increase in quantity as interest is earned
 *
 * -- tokenValue --
 * tokenValue is the value of 1 yTUSD
 * tokenValue is caluclated using reverseNormalizedIncome
 * We assume tokenValue never decreases
 */
contract AaveFinancialOpportunity is FinancialOpportunity, InstantiatableOwnable {
    using SafeMath for uint256;

    /** aTUSD token contract from AAVE */
    IAToken public aToken;

    /** LendingPool contract from AAVE */
    ILendingPool public lendingPool;

    /** TrueUSD */
    TrueUSD public token;

    /** total number of yTokens issed **/
    uint256 _totalSupply;

    modifier onlyProxyOwner() {
        require(msg.sender == proxyOwner(), "only proxy owner");
        _;
    }

    /**
     * @dev Set up Aave Opportunity
     * Called by TrueUSD
     */
    function configure(
        IAToken _aToken,            // aToken
        ILendingPool _lendingPool,  // lendingPool interface
        TrueUSD _token,             // TrueUSD
        address _owner              // owner
    ) public onlyProxyOwner {
        require(address(_aToken) != address(0), "aToken cannot be address(0)");
        require(address(_lendingPool) != address(0), "lendingPool cannot be address(0)");
        require(address(_token) != address(0), "TrueUSD cannot be address(0)");
        require(_owner != address(0), "Owner cannot be address(0)");
        aToken = _aToken;
        lendingPool = _lendingPool;
        token = _token;
        owner = _owner;
    }

    /**
     * @dev get proxy owner
     */
    function proxyOwner() public view returns(address) {
        return OwnedUpgradeabilityProxy(address(this)).proxyOwner();
    }

    /**
     * Exchange rate between TUSD and yTUSD
     * @return TUSD / yTUSD price ratio (18 decimals of percision)
     */
    function tokenValue() public view returns(uint256) {
        ILendingPoolCore core = ILendingPoolCore(lendingPool.core());
        return core.getReserveNormalizedIncome(address(token)).div(10**(27-18));
    }

    /**
     * @dev get yTUSD issued by this opportunity
     * @return total yTUSD supply
    **/
    function totalSupply() public view returns(uint256) {
        return _totalSupply;
    }

    /**
     * @dev get aToken balance of this contract
     * @return aToken balance of this contract
     */
    function aTokenBalance() public view returns(uint256) {
        return aToken.balanceOf(address(this));
    }

    /**
     * @dev get TUSD balance of this contract
     * @return TUSD balance of this contract
     */
    function tusdBalance() public view returns(uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @dev Return value of stake in yTUSD
     */
    function getValueInStake(uint256 _amount) public view returns(uint256) {
        return _amount.mul(10**18).div(tokenValue());
    }

    /**
    * @dev deposits TrueUSD into AAVE using transferFrom
    * @param from account to transferFrom TUSD
    * @param amount amount in TUSD to deposit to AAVE
    * @return yTUSD minted from this deposit
    */
    function deposit(address from, uint256 amount) external onlyOwner returns(uint256) {
        require(token.transferFrom(from, address(this), amount), "transfer from failed");
        require(token.approve(address(lendingPool.core()), amount), "approve failed");

        // calculate balance before, deposit, calculate balance after
        uint256 balanceBefore = aTokenBalance();
        lendingPool.deposit(address(token), amount, 0);
        uint256 balanceAfter = aTokenBalance();

        uint256 yTUSDAmount = getValueInStake(balanceAfter.sub(balanceBefore));

        // increase yTUSD supply
        _totalSupply = _totalSupply.add(yTUSDAmount);

        // return value in yTUSD created from this deposit
        return yTUSDAmount;
    }

    /**
     * @dev Helper to withdraw TUSD from Aave
     * aToken redemption amount is equal to yTUSD * tokenValue
     * @param _to address to transfer TUSD to
     * @param _amount amount in yTUSD to redeem
     */
    function _redeem(address _to, uint256 _amount) internal returns(uint256) {
        // calculate amount in TUSD
        uint tusdAmount = _amount.mul(tokenValue()).div(10**18);
        if (aToken.balanceOf(address(this)) < tusdAmount) {
            tusdAmount = aToken.balanceOf(address(this));
        }
        // get balance before, redeem, get balance after
        uint256 balanceBefore = tusdBalance();
        aToken.redeem(tusdAmount);
        uint256 balanceAfter = tusdBalance();

        // calculate TUSD withdrawn
        uint256 fundsWithdrawn = balanceAfter.sub(balanceBefore);

        // sub yTUSD supply
        if (getValueInStake(fundsWithdrawn) > _totalSupply) {
            _totalSupply = 0;
        } else {
            _totalSupply = _totalSupply.sub(getValueInStake(fundsWithdrawn));
        }

        // transfer to recipient and return amount withdrawn
        require(token.transfer(_to, fundsWithdrawn), "transfer failed");

        return fundsWithdrawn;
    }

    /**
     * @dev Withdraw from Aave to _to account
     * @param to account withdarw TUSD to
     * @param amount amount of yTUSD to redeem
     * @return TUSD amount returned from redeem
     */
    function redeem(address to, uint256 amount) external onlyOwner returns(uint256) {
        return _redeem(to, amount);
    }

    /**
     * @dev Redeem all yTUSD Withdraws all TUSD from AAVE
     * @param to account withdarw TUSD to
     * @return TUSD amount returned from redeem
     */
    function redeemAll(address to) external onlyOwner returns(uint256) {
        return _redeem(to, totalSupply());
    }

    function() external payable {
    }
}

// File: contracts/TrueReward/utilities/IExponentContract.sol

pragma solidity 0.5.13;

/**
 * Calculate an integer approximation of (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision.
 * Return the result along with the precision used.
 */
contract IExponentContract {
    function power(uint256 _baseN, uint256 _baseD, uint32 _expN, uint32 _expD) public view returns (uint256, uint8);
}

// File: @trusttoken/trusttokens/contracts/ClaimableContract.sol

pragma solidity 0.5.13;


/**
 * @title ClaimableContract
 * @dev The ClaimableContract contract is a copy of Claimable Contract by Zeppelin.
 and provides basic authorization control functions. Inherits storage layout of
 ProxyStorage.
 */
contract ClaimableContract is ProxyStorage {

    function owner() public view returns (address) {
        return owner_;
    }

    function pendingOwner() public view returns (address) {
        return pendingOwner_;
    }

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
    * @dev sets the original `owner` of the contract to the sender
    * at construction. Must then be reinitialized
    */
    constructor() public {
        owner_ = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner_, "only owner");
        _;
    }

    /**
    * @dev Modifier throws if called by any account other than the pendingOwner.
    */
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner_);
        _;
    }

    /**
    * @dev Allows the current owner to set the pendingOwner address.
    * @param newOwner The address to transfer ownership to.
    */
    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner_ = newOwner;
    }

    /**
    * @dev Allows the pendingOwner address to finalize the transfer.
    */
    function claimOwnership() public onlyPendingOwner {
        address _pendingOwner = pendingOwner_;
        emit OwnershipTransferred(owner_, _pendingOwner);
        owner_ = _pendingOwner;
        pendingOwner_ = address(0);
    }
}

// File: @trusttoken/trusttokens/contracts/TrustToken.sol

pragma solidity 0.5.13;




/**
 * @title TrustToken
 * @dev The TrustToken contract is a claimable contract where the
 * owner can only mint or transfer ownership. TrustTokens use 8 decimals
 * in order to prevent rewards from getting stuck in the remainder on division.
 * Tolerates dilution to slash stake and accept rewards.
 */
contract TrustToken is ValTokenWithHook, ClaimableContract {
    using SafeMath for uint256;
    Registry registry_;
    uint256 constant MAX_SUPPLY = 145000000000000000;
    /**
     * @dev initialize trusttoken and give ownership to sender
     * This is necessary to set ownership for proxy
     */
    function initialize(Registry _registry) public {
        require(!initalized, "already initalized");
        registry_ = _registry;
        owner_ = msg.sender;
        initalized = true;
    }

    function registry() internal view returns (Registry) {
        return registry_;
    }

    /**
     * @dev mint TRU
     * Can never mint more than MAX_SUPPLY = 1.45 billion
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        if (totalSupply.add(_amount) <= MAX_SUPPLY) {
            _mint(_to, _amount);
        }
        else {
            revert("Max supply exceeded");
        }
    }

    function decimals() public pure returns (uint8) {
        return 8;
    }

    function rounding() public pure returns (uint8) {
        return 8;
    }

    function name() public pure returns (string memory) {
        return "TrustToken";
    }

    function symbol() public pure returns (string memory) {
        return "TRU";
    }
}

// File: contracts/deploy/DeployHelper.sol

pragma solidity 0.5.13;














/**
 * @title DeployHelper
 * @dev Use this contract to deploy from scratch
 * Deploy contracts using a script and pass addresses into setUp
 * Deployer of DeployHelper will be final owner of proxy contracts
 *
 * Use UpgradeHelper to upgrade existing contracts
 */
contract DeployHelper {
    address public owner;
    address public deployer;

    OwnedUpgradeabilityProxy public trueUSDProxy;
    OwnedUpgradeabilityProxy public registryProxy;
    OwnedUpgradeabilityProxy public tokenControllerProxy;
    OwnedUpgradeabilityProxy public trustTokenProxy;
    OwnedUpgradeabilityProxy public assuredFinancialOpportunityProxy;
    OwnedUpgradeabilityProxy public aaveFinancialOpportunityProxy;
    OwnedUpgradeabilityProxy public stakedTokenProxy;
    OwnedUpgradeabilityProxy public liquidatorProxy;

    IExponentContract exponentContract;
    StakedToken stakedToken;

    TrueUSD trueUSD;
    TokenController tokenController;
    TrustToken trustToken;
    AssuredFinancialOpportunity assuredFinancialOpportunity;
    AaveFinancialOpportunity aaveFinancialOpportunity;
    Liquidator liquidator;
    ProvisionalRegistryImplementation registry;

    /**
     * @dev Set proxy & exponent contract addresses in storage
     */
    constructor(
        address payable trueUSDProxyAddress,
        address payable registryProxyAddress,
        address payable tokenControllerProxyAddress,
        address payable trustTokenProxyAddress,
        address payable assuredFinancialOpportunityProxyAddress,
        address payable aaveFinancialOpportunityProxyAddress,
        address payable stakedTokenProxyAddress,
        address payable liquidatorProxyAddress,
        address exponentContractAddress,
        address _owner
    ) public {
        require(trueUSDProxyAddress != address(0), "trueUSDProxyAddress cannot be address(0)");
        require(tokenControllerProxyAddress != address(0), "tokenControllerProxyAddress cannot be address(0)");
        require(trustTokenProxyAddress != address(0), "trustTokenProxyAddress cannot be address(0)");
        require(assuredFinancialOpportunityProxyAddress != address(0), "assuredFinancialOpportunityProxyAddress cannot be address(0)");
        require(aaveFinancialOpportunityProxyAddress != address(0), "aaveFinancialOpportunityProxyAddress cannot be address(0)");
        require(stakedTokenProxyAddress != address(0), "stakedTokenAddress cannot be address(0)");
        require(liquidatorProxyAddress != address(0), "liquidatorProxyAddress cannot be address(0)");
        require(registryProxyAddress != address(0), "registryProxyAddress cannot be address(0)");
        require(exponentContractAddress != address(0), "exponentContractAddress cannot be address(0)");

        owner = _owner;
        deployer = msg.sender;

        trueUSDProxy = OwnedUpgradeabilityProxy(trueUSDProxyAddress);
        trueUSD = TrueUSD(address(trueUSDProxy));
        tokenControllerProxy = OwnedUpgradeabilityProxy(tokenControllerProxyAddress);
        tokenController = TokenController(address(tokenControllerProxy));
        trustTokenProxy = OwnedUpgradeabilityProxy(trustTokenProxyAddress);
        registryProxy = OwnedUpgradeabilityProxy(registryProxyAddress);
        registry = ProvisionalRegistryImplementation(address(registry));
        assuredFinancialOpportunityProxy = OwnedUpgradeabilityProxy(assuredFinancialOpportunityProxyAddress);
        aaveFinancialOpportunityProxy = OwnedUpgradeabilityProxy(aaveFinancialOpportunityProxyAddress);
        liquidatorProxy = OwnedUpgradeabilityProxy(liquidatorProxyAddress);
        registryProxy = OwnedUpgradeabilityProxy(registryProxyAddress);
        exponentContract = IExponentContract(exponentContractAddress);
        stakedTokenProxy = OwnedUpgradeabilityProxy(stakedTokenProxyAddress);
    }

    modifier onlyDeployer() {
        require(msg.sender == deployer, "only owner");
        _;
    }

    /**
     * @dev Setup TrueUSD
     * msg.sender needs to own all the deployed contracts
     * msg.sender needs to transfer ownership to this contract for:
     * trueUSD, trueUSDProxy, tokenController, tokenControllerProxy,
     * liquidator
     */
    function setup(
        address payable trustTokenImplAddress,
        address payable assuredFinancialOpportunityImplAddress,
        address payable aaveFinancialOpportunityImplAddress,
        address payable stakedTokenImplAddress,
        address payable liquidatorImplAddress,
        address aTokenAddress,
        address lendingPoolAddress,
        address outputUniswapAddress,
        address stakeUniswapAddress
    ) public onlyDeployer {
        require(trustTokenImplAddress != address(0), "trustTokenImplAddress cannot be address(0)");
        require(assuredFinancialOpportunityImplAddress != address(0), "assuredFinancialOpportunityImplAddress cannot be address(0)");
        require(aaveFinancialOpportunityImplAddress != address(0), "aaveFinancialOpportunityImplAddress cannot be address(0)");
        require(stakedTokenImplAddress != address(0), "stakedTokenImplAddress cannot be address(0)");
        require(liquidatorImplAddress != address(0), "liquidatorImplAddress cannot be address(0)");

        initTrustToken(trustTokenImplAddress);

        initAssurance(
            assuredFinancialOpportunityImplAddress,
            aaveFinancialOpportunityImplAddress,
            stakedTokenImplAddress,
            liquidatorImplAddress,
            aTokenAddress,
            lendingPoolAddress,
            outputUniswapAddress,
            stakeUniswapAddress
        );
    }

    function initTrustToken(address trustTokenImplAddress) internal {
        require(trustTokenProxy.pendingProxyOwner() == address(this), "not trust token proxy owner");

        trustTokenProxy.claimProxyOwnership();
        trustTokenProxy.upgradeTo(trustTokenImplAddress);
        trustToken = TrustToken(address(trustTokenProxy));
        trustToken.initialize(ProvisionalRegistryImplementation(address(registryProxy)));

        trustToken.transferOwnership(owner);
        trustTokenProxy.transferProxyOwnership(owner);
    }

    /// @dev Initialize Assurance
    function initAssurance(
        address assuredFinancialOpportunityImplAddress,
        address aaveFinancialOpportunityImplAddress,
        address stakedTokenImplAddress,
        address liquidatorImplAddress,
        address aTokenAddress,
        address lendingPoolAddress,
        address outputUniswapAddress,
        address stakeUniswapAddress
    ) internal {
        assuredFinancialOpportunityProxy.claimProxyOwnership();
        assuredFinancialOpportunityProxy.upgradeTo(assuredFinancialOpportunityImplAddress);
        assuredFinancialOpportunity = AssuredFinancialOpportunity(address(assuredFinancialOpportunityProxy));

        aaveFinancialOpportunityProxy.claimProxyOwnership();
        aaveFinancialOpportunityProxy.upgradeTo(aaveFinancialOpportunityImplAddress);
        aaveFinancialOpportunity = AaveFinancialOpportunity(address(aaveFinancialOpportunityProxy));

        stakedTokenProxy.claimProxyOwnership();
        stakedTokenProxy.upgradeTo(stakedTokenImplAddress);
        stakedToken = StakedToken(address(stakedTokenProxy));

        stakedToken.configure(
            StakingAsset(address(trustTokenProxy)),
            StakingAsset(address(trueUSDProxy)),
            ProvisionalRegistryImplementation(address(registryProxy)),
            address(liquidatorProxy)
        );

        liquidatorProxy.claimProxyOwnership();
        liquidatorProxy.upgradeTo(liquidatorImplAddress);
        liquidator = Liquidator(address(liquidatorProxy));

        liquidator.configure(
            address(registry),
            address(trueUSDProxy),
            address(trustTokenProxy),
            outputUniswapAddress,
            stakeUniswapAddress
        );

        liquidator.setPool(address(stakedToken));

        aaveFinancialOpportunity.configure(
            IAToken(aTokenAddress),
            ILendingPool(lendingPoolAddress),
            TrueUSD(trueUSD),
            address(assuredFinancialOpportunity)
        );

        assuredFinancialOpportunity.configure(
            address(aaveFinancialOpportunity),
            address(stakedToken),
            address(liquidator),
            address(exponentContract),
            address(trueUSD),
            address(trueUSD)
        );

        liquidator.transferOwnership(address(assuredFinancialOpportunity));

        assuredFinancialOpportunity.claimLiquidatorOwnership();
        assuredFinancialOpportunity.transferOwnership(owner);

        liquidatorProxy.transferProxyOwnership(owner);
        assuredFinancialOpportunityProxy.transferProxyOwnership(owner);
        aaveFinancialOpportunityProxy.transferProxyOwnership(owner);
        stakedTokenProxy.transferProxyOwnership(owner);
    }
}
