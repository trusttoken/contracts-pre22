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
        require(registry.hasAttribute1ButNotAttribute2(_to, HAS_PASSED_KYC_AML, IS_BLACKLISTED), "_to cannot mint");
        address shiftedAddress = address(uint256(_to) >> 20);
        uint256 depositAddressValue = registry.getAttributeValue(shiftedAddress, IS_DEPOSIT_ADDRESS);
        totalSupply_ = totalSupply_.add(_value);
        address originalTo = _to;
        emit Mint(_to, _value);
        emit Transfer(address(0), _to, _value);
        if (depositAddressValue != 0) {
            _to = address(depositAddressValue);
            emit Transfer(originalTo, _to, _value);
        }
        balances.addBalance(_to, _value);
        uint256 hasHook = registry.getAttributeValue(_to, IS_REGISTERED_CONTRACT);
        if (hasHook != 0) {
            if (depositAddressValue != 0) {
                TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
            } else {
                TrueCoinReceiver(_to).tokenFallback(address(0), _value);
            }
        }
    }
}
