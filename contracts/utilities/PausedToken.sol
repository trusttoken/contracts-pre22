pragma solidity ^0.5.13;

import "../HasOwner.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract PausedToken is HasOwner, RegistryClone {
    using SafeMath for uint256;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event AllowanceSheetSet(address indexed sheet);
    event BalanceSheetSet(address indexed sheet);
    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    event WipeBlacklistedAccount(address indexed account, uint256 balance);
    event SetRegistry(address indexed registry);

    function decimals() public pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    /**  
    *@dev send all eth balance in the TrueUSD contract to another address
    */
    function reclaimEther(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**  
    *@dev send all token balance of an arbitary erc20 token
    in the TrueUSD contract to another address
    */
    function reclaimToken(IERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(_to, balance);
    }

    /**  
    *@dev allows owner of TrueUSD to gain ownership of any contract that TrueUSD currently owns
    */
    function reclaimContract(Ownable _ownable) external onlyOwner {
        _ownable.transferOwnership(owner);
    }


    function totalSupply() public view returns (uint256) {
        return totalSupply_;
    }

    /**  
    *@dev Return the remaining sponsored gas slots
    */
    function remainingGasRefundPool() public view returns (uint length) {
        assembly {
            length := sload(0xfffff)
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

    bytes32 constant CAN_SET_FUTURE_REFUND_MIN_GAS_PRICE = "canSetFutureRefundMinGasPrice";

    function setMinimumGasPriceForFutureRefunds(uint256 _minimumGasPriceForFutureRefunds) public {
        require(registry.hasAttribute(msg.sender, CAN_SET_FUTURE_REFUND_MIN_GAS_PRICE));
        minimumGasPriceForFutureRefunds = _minimumGasPriceForFutureRefunds;
    }

    function balanceOf(address _who) public view returns (uint256) {
        return _getBalance(_who);
    }
    function _getBalance(address _who) internal view returns (uint256 value) {
        return _balanceOf[_who];
    }
    function _setBalance(address _who, uint256 _value) internal {
        _balanceOf[_who] = _value;
    }
    function allowance(address _who, address _spender) public view returns (uint256) {
        return _getAllowance(_who, _spender);
    }
    function _getAllowance(address _who, address _spender) internal view returns (uint256 value) {
        return _allowance[_who][_spender];
    }
    function transfer(address /*_to*/, uint256 /*_value*/) public returns (bool) {
        revert("Token Paused");
    }

    function transferFrom(address /*_from*/, address /*_to*/, uint256 /*_value*/) public returns (bool) {
        revert("Token Paused");
    }

    function burn(uint256 /*_value*/) public {
        revert("Token Paused");
    }

    function mint(address /*_to*/, uint256 /*_value*/) public onlyOwner {
        revert("Token Paused");
    }
    
    function approve(address /*_spender*/, uint256 /*_value*/) public returns (bool) {
        revert("Token Paused");
    }

    function increaseAllowance(address /*_spender*/, uint /*_addedValue*/) public returns (bool) {
        revert("Token Paused");
    }
    function decreaseAllowance(address /*_spender*/, uint /*_subtractedValue*/) public returns (bool) {
        revert("Token Paused");
    }
    function paused() public pure returns (bool) {
        return true;
    }
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

    bytes32 constant IS_BLACKLISTED = "isBlacklisted";
    function wipeBlacklistedAccount(address _account) public onlyOwner {
        require(attributes[IS_BLACKLISTED][_account] != 0, "_account is not blacklisted");
        uint256 oldValue = _getBalance(_account);
        _setBalance(_account, 0);
        totalSupply_ = totalSupply_.sub(oldValue);
        emit WipeBlacklistedAccount(_account, oldValue);
        emit Transfer(_account, address(0), oldValue);
    }

}

/** @title PausedDelegateERC20
Accept forwarding delegation calls from the old TrueUSD (V1) contract. This way the all the ERC20
functions in the old contract still works (except Burn). 
*/
contract PausedDelegateERC20 is PausedToken {

    address public constant DELEGATE_FROM = 0x8dd5fbCe2F6a956C3022bA3663759011Dd51e73E;
    
    modifier onlyDelegateFrom() {
        require(msg.sender == DELEGATE_FROM);
        _;
    }

    function delegateTotalSupply() public view returns (uint256) {
        return totalSupply();
    }

    function delegateBalanceOf(address who) public view returns (uint256) {
        return balanceOf(who);
    }

    function delegateTransfer(address /*to*/, uint256 /*value*/, address /*origSender*/) public onlyDelegateFrom returns (bool) {
        revert("Token Paused");
    }

    function delegateAllowance(address owner, address spender) public view returns (uint256) {
        return _getAllowance(owner, spender);
    }

    function delegateTransferFrom(address /*from*/, address /*to*/, uint256 /*value*/, address /*origSender*/) public onlyDelegateFrom returns (bool) {
        revert("Token Paused");
    }

    function delegateApprove(address /*spender*/, uint256 /*value*/, address /*origSender*/) public onlyDelegateFrom returns (bool) {
        revert("Token Paused");
    }

    function delegateIncreaseApproval(address /*spender*/, uint /*addedValue*/, address /*origSender*/) public onlyDelegateFrom returns (bool) {
        revert("Token Paused");
    }

    function delegateDecreaseApproval(address /*spender*/, uint /*subtractedValue*/, address /*origSender*/) public onlyDelegateFrom returns (bool) {
        revert("Token Paused");
    }
}
