pragma solidity ^0.4.23;

import "./CompliantToken.sol";
import "./DepositToken.sol";
import "./TokenWithHook.sol";

contract CompliantDepositTokenWithHook is CompliantToken, DepositToken, TokenWithHook {

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _sender) internal {
        bool hasHook;
        address originalTo = _to;
        (_to, hasHook) = registry.requireCanTransferFrom(_sender, _from, _to);
        allowances.subAllowance(_from, _sender, _value);
        balances.subBalance(_from, _value);
        balances.addBalance(_to, _value);
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
        (_to, hasHook) = registry.requireCanTransfer(_from, _to);
        balances.subBalance(_from, _value);
        balances.addBalance(_to, _value);
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
        (_to, hasHook) = registry.requireCanMint(_to);
        totalSupply_ = totalSupply_.add(_value);
        emit Mint(originalTo, _value);
        emit Transfer(address(0), originalTo, _value);
        if (_to != originalTo) {
            emit Transfer(originalTo, _to, _value);
        }
        balances.addBalance(_to, _value);
        if (hasHook) {
            if (_to != originalTo) {
                TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
            } else {
                TrueCoinReceiver(_to).tokenFallback(address(0), _value);
            }
        }
    }
}
