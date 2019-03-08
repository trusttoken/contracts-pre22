pragma solidity ^0.4.23;

import "./TrueCoinReceiver.sol";
import "./modularERC20/ModularBurnableToken.sol";
import "../registry/contracts/Registry.sol";
import "./ProxyStorage.sol";

contract CompliantDepositTokenWithHook is ModularBurnableToken, RegistryClone {

    bytes32 constant IS_REGISTERED_CONTRACT = "isRegisteredContract";
    bytes32 constant IS_DEPOSIT_ADDRESS = "isDepositAddress";
    uint256 constant REDEMPTION_ADDRESS_COUNT = 0x100000;
    bytes32 constant IS_BLACKLISTED = "isBlacklisted";
    bytes32 constant CAN_BURN = "canBurn";
    bytes32 constant HAS_PASSED_KYC_AML = "hasPassedKYC/AML";

    /**
    * @dev transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        address _from = msg.sender;
        if (uint256(_to) < REDEMPTION_ADDRESS_COUNT) {
            _requireCanTransfer(_from, _to);
            _value -= _value % CENT;
            _burnFromAllArgs(_from, _to, _value);
        } else {
            _transferAllArgs(_from, _to, _value);
        }
        return true;
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        if (uint256(_to) < REDEMPTION_ADDRESS_COUNT) {
            _requireCanTransferFrom(msg.sender, _from, _to);
            _value -= _value % CENT;
            _subAllowance(_from, msg.sender, _value);
            _burnFromAllArgs(_from, _to, _value);
        } else {
            _transferFromAllArgs(_from, _to, _value, msg.sender);
        }
        return true;
    }

    function _burnFromAllArgs(address _from, address _to, uint256 _value) internal {
        _requireCanBurn(_to);
        require(_value >= burnMin, "below min burn bound");
        require(_value <= burnMax, "exceeds max burn bound");
        _subBalance(_from, _value);
        emit Transfer(_from, _to, _value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_to, _value);
        emit Transfer(_to, address(0), _value);
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _sender) internal {
        bool hasHook;
        address originalTo = _to;
        (_to, hasHook) = _requireCanTransferFrom(_sender, _from, _to);
        _subAllowance(_from, _sender, _value);
        _subBalance(_from, _value);
        _addBalance(_to, _value);
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

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool hasHook;
        address originalTo = _to;
        (_to, hasHook) = _requireCanTransfer(_from, _to);
        _subBalance(_from, _value);
        _addBalance(_to, _value);
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
        emit SetRegistry(registry);
    }

    modifier onlyRegistry {
      require(msg.sender == address(registry));
      _;
    }

    function syncAttributeValue(address _who, bytes32 _attribute, uint256 _value) public onlyRegistry {
        attributes[_who][_attribute] = _value;
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

    function _isBlacklisted(address _account) internal view returns (bool) {
        return attributes[_account][IS_BLACKLISTED] != 0;
    }

    function _requireCanTransfer(address _from, address _to) internal view returns (address, bool) {
        require (attributes[_from][IS_BLACKLISTED] == 0, "blacklisted");
        uint256 depositAddressValue = attributes[address(uint256(_to) >> 20)][IS_DEPOSIT_ADDRESS];
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        require (attributes[_to][IS_BLACKLISTED] == 0, "blacklisted");
        return (_to, attributes[_to][IS_REGISTERED_CONTRACT] != 0);
    }

    function _requireCanTransferFrom(address _sender, address _from, address _to) internal view returns (address, bool) {
        require (attributes[_sender][IS_BLACKLISTED] == 0, "blacklisted");
        return _requireCanTransfer(_from, _to);
    }

    function _requireCanMint(address _to) internal view returns (address, bool) {
        require (attributes[_to][HAS_PASSED_KYC_AML] != 0, "no kycaml");
        require (attributes[_to][IS_BLACKLISTED] == 0, "blacklisted");
        uint256 depositAddressValue = attributes[address(uint256(_to) >> 20)][IS_DEPOSIT_ADDRESS];
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        return (_to, attributes[_to][IS_REGISTERED_CONTRACT] != 0);
    }

    function _requireCanBurn(address _from) internal view {
        require (attributes[_from][CAN_BURN] != 0, "cannot burn from this address");
        require (attributes[_from][IS_BLACKLISTED] == 0, "blacklisted");
    }
}
