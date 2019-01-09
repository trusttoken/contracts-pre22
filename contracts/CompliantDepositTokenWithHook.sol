pragma solidity ^0.4.23;

import "./CompliantToken.sol";
import "./DepositToken.sol";
import "./TrueCoinReceiver.sol";

contract CompliantDepositTokenWithHook is CompliantToken, DepositToken {

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _sender) internal {
        bool hasHook;
        address originalTo = _to;
        (_to, hasHook) = registry.requireCanTransfer(_from, _to);
        allowances.subAllowance(_from, _sender, _value);
        balances.subBalance(_from, _value);
        balances.addBalance(_to, _value);
        if (originalTo != _to) {
            emit Transfer(_from, originalTo, _value);
            emit Transfer(originalTo, _to, _value);
            if (hasHook) {
                TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
            }
        } else {
            emit Transfer(_from, _to, _value);
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
        if (originalTo != _to) {
            emit Transfer(_from, originalTo, _value);
            emit Transfer(originalTo, _to, _value);
            if (hasHook) {
                TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
            }
        } else {
            emit Transfer(_from, _to, _value);
            if (hasHook) {
                TrueCoinReceiver(_to).tokenFallback(_from, _value);
            }
        }
    }

    function mint(address _to, uint256 _value) public onlyOwner {
        require(_to != address(0), "to address cannot be zero");
        require(registry.hasAttribute1ButNotAttribute2(_to, HAS_PASSED_KYC_AML, IS_BLACKLISTED), "_to cannot mint");
        address shiftedAddress = address(uint(_to) >> 20);
        uint depositAddressValue = registry.getAttributeValue(shiftedAddress, IS_DEPOSIT_ADDRESS);
        totalSupply_ = totalSupply_.add(_value);
        if (depositAddressValue != 0) {
            address originalTo = _to;
            emit Mint(originalTo, _value);
            _to = address(depositAddressValue);
            emit Transfer(address(0), originalTo, _value);
            emit Transfer(originalTo, _to, _value);
        } else {
            emit Mint(_to, _value);
            emit Transfer(address(0), _to, _value);
        }
        balances.addBalance(_to, _value);
    }
}
