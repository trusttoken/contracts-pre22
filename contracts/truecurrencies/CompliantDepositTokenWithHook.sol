// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCoinReceiver} from "./TrueCoinReceiver.sol";
import {Registry, RegistryClone} from "../registry/Registry.sol";
import {ReclaimerToken} from "./ReclaimerToken.sol";
import {BurnableTokenWithBounds} from "./BurnableTokenWithBounds.sol";
import {GasRefundToken} from "./GasRefundToken.sol";

abstract contract CompliantDepositTokenWithHook is ReclaimerToken, RegistryClone, BurnableTokenWithBounds, GasRefundToken {
    bytes32 constant IS_REGISTERED_CONTRACT = "isRegisteredContract";
    bytes32 constant IS_DEPOSIT_ADDRESS = "isDepositAddress";
    uint256 constant REDEMPTION_ADDRESS_COUNT = 0x100000;
    bytes32 constant IS_BLACKLISTED = "isBlacklisted";

    /**
     * @dev Attribute name for ability to burn the currency
     * @return Attribute name (e.g. canBurnCAD or canBurnGBP)
     */
    function canBurn() internal virtual pure returns (bytes32);

    /**
     * @dev transfer tokens to a specified address
     * @param _to The address to transfer to.
     * @param _value The amount to be transferred.
     */
    function transfer(address _to, uint256 _value) public returns (bool) {
        _transferAllArgs(msg.sender, _to, _value);
        return true;
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param _from The address to send tokens from
     * @param _to The address that will receive the tokens
     * @param _value The amount of tokens to be transferred
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public returns (bool) {
        _transferFromAllArgs(_from, _to, _value, msg.sender);
        return true;
    }

    /**
     * @dev Helper function for burning tokens by allowed account
     * @param _from The address whose tokens should be burnt
     * @param _to The address which should be able to burn this token
     * @param _value Amount to burn
     * @param _spender Transaction sender
     */
    function _burnFromAllowanceAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal {
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

    /**
     * @dev Helper function for burning tokens
     * @param _from The address whose tokens should be burnt
     * @param _to The address which should be able to burn this token
     * @param _value Amount to burn
     */
    function _burnFromAllArgs(
        address _from,
        address _to,
        uint256 _value
    ) internal {
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

    /**
     * @dev See transferFrom
     */
    function _transferFromAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal virtual returns (address) {
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

    /**
     * @dev See transfer
     */
    function _transferAllArgs(
        address _from,
        address _to,
        uint256 _value
    ) internal virtual returns (address) {
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

    /**
     * @dev Mint new tokens
     * @param _to Address which should receive the tokens
     * @param _value Amount of minted tokens
     */
    function mint(address _to, uint256 _value) public virtual onlyOwner {
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

    /**
     * @dev Emitted when the tokens owned by blacklisted account were destroyed
     * @param account Blacklisted account
     * @param balance Balance before wipe
     */
    event WipeBlacklistedAccount(address indexed account, uint256 balance);

    /// @dev Emitted when new registry is set
    event SetRegistry(address indexed registry);

    /**
     * @dev Point to the registry that contains all compliance related data
     * @param _registry The address of the registry instance
     */
    function setRegistry(Registry _registry) public onlyOwner {
        registry = _registry;
        emit SetRegistry(address(registry));
    }

    modifier onlyRegistry {
        require(msg.sender == address(registry));
        _;
    }

    /**
     * @dev Function called by Registry when attribute is updated
     * Contract must be subscribed in registry for the attribute in order for this function to be called
     */
    function syncAttributeValue(
        address _who,
        bytes32 _attribute,
        uint256 _value
    ) public override onlyRegistry {
        attributes[_attribute][_who] = _value;
    }

    /**
     * @dev Check if tokens can be burnt from account and call BurnableTokenWithBounds._burnAllArgs
     */
    function _burnAllArgs(address _from, uint256 _value) internal override {
        _requireCanBurn(_from);
        super._burnAllArgs(_from, _value);
    }

    /**
     * @dev Destroy the tokens owned by a blacklisted account
     */
    function wipeBlacklistedAccount(address _account) public onlyOwner {
        require(_isBlacklisted(_account), "_account is not blacklisted");
        uint256 oldValue = _getBalance(_account);
        _setBalance(_account, 0);
        totalSupply_ = totalSupply_.sub(oldValue);
        emit WipeBlacklistedAccount(_account, oldValue);
        emit Transfer(_account, address(0), oldValue);
    }

    /**
     * @dev Check if account is blacklisted in registry
     * __Note__ Contract should be subscribed to IS_BLACKLISTED attribute
     */
    function _isBlacklisted(address _account) internal virtual view returns (bool blacklisted) {
        return attributes[IS_BLACKLISTED][_account] != 0;
    }

    /**
     * @dev Check if funds can be transferred between accounts
     * @param _from Sender
     * @param _to Receiver
     */
    function _requireCanTransfer(address _from, address _to) internal virtual view returns (address, bool) {
        uint256 depositAddressValue = attributes[IS_DEPOSIT_ADDRESS][address(uint256(_to) >> 20)];
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        require(attributes[IS_BLACKLISTED][_to] == 0, "blacklisted");
        require(attributes[IS_BLACKLISTED][_from] == 0, "blacklisted");
        return (_to, attributes[IS_REGISTERED_CONTRACT][_to] != 0);
    }

    /**
     * @dev Check if funds can be transferred between accounts with allowance
     * @param _spender Transaction sender
     * @param _from Sender
     * @param _to Receiver
     */
    function _requireCanTransferFrom(
        address _spender,
        address _from,
        address _to
    ) internal virtual view returns (address, bool) {
        require(attributes[IS_BLACKLISTED][_spender] == 0, "blacklisted");
        uint256 depositAddressValue = attributes[IS_DEPOSIT_ADDRESS][address(uint256(_to) >> 20)];
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        require(attributes[IS_BLACKLISTED][_to] == 0, "blacklisted");
        require(attributes[IS_BLACKLISTED][_from] == 0, "blacklisted");
        return (_to, attributes[IS_REGISTERED_CONTRACT][_to] != 0);
    }

    /**
     * @dev Check if tokens can be minted for account and it is not blacklisted
     * @param _to Receiver
     */
    function _requireCanMint(address _to) internal virtual view returns (address, bool) {
        uint256 depositAddressValue = attributes[IS_DEPOSIT_ADDRESS][address(uint256(_to) >> 20)];
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
        }
        require(attributes[IS_BLACKLISTED][_to] == 0, "blacklisted");
        return (_to, attributes[IS_REGISTERED_CONTRACT][_to] != 0);
    }

    /**
     * @dev Check if tokens can be burnt at address
     * @param _from Burner
     */
    function _requireOnlyCanBurn(address _from) internal virtual view {
        require(attributes[canBurn()][_from] != 0, "cannot burn from this address");
    }

    /**
     * @dev Check if tokens can be burnt from account and that the account is not blacklisted
     * @param _from Owner of tokens
     */
    function _requireCanBurn(address _from) internal virtual view {
        require(attributes[IS_BLACKLISTED][_from] == 0, "blacklisted");
        require(attributes[canBurn()][_from] != 0, "cannot burn from this address");
    }

    /**
     * @dev Is token operations paused
     */
    function paused() public pure returns (bool) {
        return false;
    }
}
