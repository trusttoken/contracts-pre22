pragma solidity ^0.4.23;

// CanDelegateV1: the subset of V1 required for CanDelegate

library SafeMathV1 {

  /**
  * @dev Multiplies two numbers, throws on overflow.
  */
  function mul(uint256 a, uint256 b) internal pure returns (uint256) {
    if (a == 0) {
      return 0;
    }
    uint256 c = a * b;
    assert(c / a == b);
    return c;
  }

  /**
  * @dev Integer division of two numbers, truncating the quotient.
  */
  function div(uint256 a, uint256 b) internal pure returns (uint256) {
    // assert(b > 0); // Solidity automatically throws when dividing by 0
    uint256 c = a / b;
    // assert(a == b * c + a % b); // There is no case in which this doesn't hold
    return c;
  }

  /**
  * @dev Substracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
  */
  function sub(uint256 a, uint256 b) internal pure returns (uint256) {
    assert(b <= a);
    return a - b;
  }

  /**
  * @dev Adds two numbers, throws on overflow.
  */
  function add(uint256 a, uint256 b) internal pure returns (uint256) {
    uint256 c = a + b;
    assert(c >= a);
    return c;
  }
}
contract OwnableV1 {
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
    OwnershipTransferred(owner, newOwner);
    owner = newOwner;
  }

}

contract ERC20BasicV1 {
  function totalSupply() public view returns (uint256);
  function balanceOf(address who) public view returns (uint256);
  function transfer(address to, uint256 value) public returns (bool);
  event Transfer(address indexed from, address indexed to, uint256 value);
}

contract ERC20V1 is ERC20BasicV1 {
  function allowance(address owner, address spender) public view returns (uint256);
  function transferFrom(address from, address to, uint256 value) public returns (bool);
  function approve(address spender, uint256 value) public returns (bool);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}

contract ClaimableV1 is OwnableV1 {
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
    OwnershipTransferred(owner, pendingOwner);
    owner = pendingOwner;
    pendingOwner = address(0);
  }
}

contract AllowanceSheetV1 is ClaimableV1 {
    using SafeMathV1 for uint256;

    mapping (address => mapping (address => uint256)) public allowanceOf;

    function addAllowance(address tokenHolder, address spender, uint256 value) public onlyOwner {
        allowanceOf[tokenHolder][spender] = allowanceOf[tokenHolder][spender].add(value);
    }

    function subAllowance(address tokenHolder, address spender, uint256 value) public onlyOwner {
        allowanceOf[tokenHolder][spender] = allowanceOf[tokenHolder][spender].sub(value);
    }

    function setAllowance(address tokenHolder, address spender, uint256 value) public onlyOwner {
        allowanceOf[tokenHolder][spender] = value;
    }
}

contract BalanceSheetV1 is ClaimableV1 {
    using SafeMathV1 for uint256;

    mapping (address => uint256) public balanceOf;

    function addBalance(address addr, uint256 value) public onlyOwner {
        balanceOf[addr] = balanceOf[addr].add(value);
    }

    function subBalance(address addr, uint256 value) public onlyOwner {
        balanceOf[addr] = balanceOf[addr].sub(value);
    }

    function setBalance(address addr, uint256 value) public onlyOwner {
        balanceOf[addr] = value;
    }
}
contract BasicTokenV1 is ERC20BasicV1, ClaimableV1 {
  using SafeMathV1 for uint256;

  BalanceSheetV1 public balances;

  uint256 totalSupply_;

  function setBalanceSheet(address sheet) external onlyOwner {
    balances = BalanceSheetV1(sheet);
    balances.claimOwnership();
  }

  /**
  * @dev total number of tokens in existence
  */
  function totalSupply() public view returns (uint256) {
    return totalSupply_;
  }

  /**
  * @dev transfer token for a specified address
  * @param _to The address to transfer to.
  * @param _value The amount to be transferred.
  */
  function transfer(address _to, uint256 _value) public returns (bool) {
    transferAllArgsNoAllowance(msg.sender, _to, _value);
    return true;
  }

  function transferAllArgsNoAllowance(address _from, address _to, uint256 _value) internal {
    require(_to != address(0));
    require(_from != address(0));
    require(_value <= balances.balanceOf(_from));

    // SafeMath.sub will throw if there is not enough balance.
    balances.subBalance(_from, _value);
    balances.addBalance(_to, _value);
    Transfer(_from, _to, _value);
  }

  /**
  * @dev Gets the balance of the specified address.
  * @param _owner The address to query the the balance of.
  * @return An uint256 representing the amount owned by the passed address.
  */
  function balanceOf(address _owner) public view returns (uint256 balance) {
    return balances.balanceOf(_owner);
  }
}
contract StandardTokenV1 is ERC20V1, BasicTokenV1 {

  AllowanceSheetV1 public allowances;

  function setAllowanceSheet(address sheet) external onlyOwner {
    allowances = AllowanceSheetV1(sheet);
    allowances.claimOwnership();
  }

  /**
   * @dev Transfer tokens from one address to another
   * @param _from address The address which you want to send tokens from
   * @param _to address The address which you want to transfer to
   * @param _value uint256 the amount of tokens to be transferred
   */
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
    transferAllArgsYesAllowance(_from, _to, _value, msg.sender);
    return true;
  }

  function transferAllArgsYesAllowance(address _from, address _to, uint256 _value, address spender) internal {
    require(_value <= allowances.allowanceOf(_from, spender));

    allowances.subAllowance(_from, spender, _value);
    transferAllArgsNoAllowance(_from, _to, _value);
  }

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
    approveAllArgs(_spender, _value, msg.sender);
    return true;
  }

  function approveAllArgs(address _spender, uint256 _value, address _tokenHolder) internal {
    allowances.setAllowance(_tokenHolder, _spender, _value);
    Approval(_tokenHolder, _spender, _value);
  }

  /**
   * @dev Function to check the amount of tokens that an owner allowed to a spender.
   * @param _owner address The address which owns the funds.
   * @param _spender address The address which will spend the funds.
   * @return A uint256 specifying the amount of tokens still available for the spender.
   */
  function allowance(address _owner, address _spender) public view returns (uint256) {
    return allowances.allowanceOf(_owner, _spender);
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
    increaseApprovalAllArgs(_spender, _addedValue, msg.sender);
    return true;
  }

  function increaseApprovalAllArgs(address _spender, uint _addedValue, address tokenHolder) internal {
    allowances.addAllowance(tokenHolder, _spender, _addedValue);
    Approval(tokenHolder, _spender, allowances.allowanceOf(tokenHolder, _spender));
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
    decreaseApprovalAllArgs(_spender, _subtractedValue, msg.sender);
    return true;
  }

  function decreaseApprovalAllArgs(address _spender, uint _subtractedValue, address tokenHolder) internal {
    uint oldValue = allowances.allowanceOf(tokenHolder, _spender);
    if (_subtractedValue > oldValue) {
      allowances.setAllowance(tokenHolder, _spender, 0);
    } else {
      allowances.subAllowance(tokenHolder, _spender, _subtractedValue);
    }
    Approval(tokenHolder, _spender, allowances.allowanceOf(tokenHolder, _spender));
  }

}
interface DelegateERC20V1 {
  function delegateTotalSupply() public view returns (uint256);
  function delegateBalanceOf(address who) public view returns (uint256);
  function delegateTransfer(address to, uint256 value, address origSender) public returns (bool);
  function delegateAllowance(address owner, address spender) public view returns (uint256);
  function delegateTransferFrom(address from, address to, uint256 value, address origSender) public returns (bool);
  function delegateApprove(address spender, uint256 value, address origSender) public returns (bool);
  function delegateIncreaseApproval(address spender, uint addedValue, address origSender) public returns (bool);
  function delegateDecreaseApproval(address spender, uint subtractedValue, address origSender) public returns (bool);
}
contract CanDelegateV1 is StandardTokenV1 {
    // If this contract needs to be upgraded, the new contract will be stored
    // in 'delegate' and any ERC20 calls to this contract will be delegated to that one.
    DelegateERC20V1 public delegate;

    event DelegatedTo(address indexed newContract);

    // Can undelegate by passing in newContract = address(0)
    function delegateToNewContract(DelegateERC20V1 newContract) public onlyOwner {
        delegate = newContract;
        DelegatedTo(delegate);
    }

    function transferChild(address _child, address _newOwner) public onlyOwner {
        OwnableV1(_child).transferOwnership(_newOwner);
    }

    // If a delegate has been designated, all ERC20 calls are forwarded to it
    function transfer(address to, uint256 value) public returns (bool) {
        if (delegate == address(0)) {
            return super.transfer(to, value);
        } else {
            return delegate.delegateTransfer(to, value, msg.sender);
        }
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        if (delegate == address(0)) {
            return super.transferFrom(from, to, value);
        } else {
            return delegate.delegateTransferFrom(from, to, value, msg.sender);
        }
    }

    function balanceOf(address who) public view returns (uint256) {
        if (delegate == address(0)) {
            return super.balanceOf(who);
        } else {
            return delegate.delegateBalanceOf(who);
        }
    }

    function approve(address spender, uint256 value) public returns (bool) {
        if (delegate == address(0)) {
            return super.approve(spender, value);
        } else {
            return delegate.delegateApprove(spender, value, msg.sender);
        }
    }

    function allowance(address _owner, address spender) public view returns (uint256) {
        if (delegate == address(0)) {
            return super.allowance(_owner, spender);
        } else {
            return delegate.delegateAllowance(_owner, spender);
        }
    }

    function totalSupply() public view returns (uint256) {
        if (delegate == address(0)) {
            return super.totalSupply();
        } else {
            return delegate.delegateTotalSupply();
        }
    }

    function increaseApproval(address spender, uint addedValue) public returns (bool) {
        if (delegate == address(0)) {
            return super.increaseApproval(spender, addedValue);
        } else {
            return delegate.delegateIncreaseApproval(spender, addedValue, msg.sender);
        }
    }

    function decreaseApproval(address spender, uint subtractedValue) public returns (bool) {
        if (delegate == address(0)) {
            return super.decreaseApproval(spender, subtractedValue);
        } else {
            return delegate.delegateDecreaseApproval(spender, subtractedValue, msg.sender);
        }
    }
}
