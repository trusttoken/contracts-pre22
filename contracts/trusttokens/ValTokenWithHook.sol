// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "./ERC20.sol";
import "./RegistrySubscriber.sol";
import "./TrueCoinReceiver.sol";

abstract contract ValTokenWithHook is ModularStandardToken, RegistrySubscriber {
    event Burn(address indexed from, uint256 indexed amount);
    event Mint(address indexed to, uint256 indexed amount);

    /**
     * @dev Check if address supports token transfer fallback and resolve autosweep
     * @param _to address Receiver account
     *
     * @return to address If _to is not an autosweep address, they are same. Otherwise equals autosweep root
     * @return hook bool True if _to supports transfer fallback
     */
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

    /**
     * @dev Reverts if _from is an autosweep address (and is not an autosweep root)
     */
    modifier resolveSender(address _from) {
        uint256 flags = (attributes[uint144(uint160(_from) >> 20)]);
        address from = address(flags);
        if (from != address(0)) {
            require(from == _from, "account collision");
        }
        _;
    }

    /// @dev Check allowance and perform transfer
    function _transferFromAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal {
        _subAllowance(_from, _spender, _value);
        _transferAllArgs(_from, _to, _value);
    }

    /// @dev Transfer using allowance
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) external returns (bool) {
        _transferFromAllArgs(_from, _to, _value, msg.sender);
        return true;
    }

    /// @dev Transfer tokens to recipient
    function transfer(address _to, uint256 _value) external returns (bool) {
        _transferAllArgs(msg.sender, _to, _value);
        return true;
    }

    // @dev Swap balances and call fallback if needed
    function _transferAllArgs(
        address _from,
        address _to,
        uint256 _value
    ) internal virtual resolveSender(_from) {
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

    /**
     * @dev Burn
     * @param _from address Account whose tokens will burn
     * @param _value uint256 Amount of tokens to be burnt
     *
     * @return resultBalance_ uint256 New balance of _from
     * @return resultSupply_ uint256 New total supply
     */
    function _burn(address _from, uint256 _value) internal virtual returns (uint256 resultBalance_, uint256 resultSupply_) {
        emit Transfer(_from, address(0), _value);
        emit Burn(_from, _value);
        resultBalance_ = _subBalance(_from, _value);
        resultSupply_ = totalSupply.sub(_value, "removing more stake than in supply");
        totalSupply = resultSupply_;
    }

    /**
     * @dev Mint new tokens
     * @param _to address Tokens receiver
     * @param _value uint256 Amount of tokens to be minted
     */
    function _mint(address _to, uint256 _value) internal virtual {
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
