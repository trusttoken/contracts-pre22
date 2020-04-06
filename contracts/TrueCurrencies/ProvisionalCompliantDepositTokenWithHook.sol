pragma solidity ^0.5.13;

import "@trusttoken/registry/contracts/ProvisionalRegistry.sol";
import "./CompliantDepositTokenWithHook.sol";
import "./DeprecatedGasRefundPool.sol";

// Supports balance and allowance migration at great cost
contract ProvisionalCompliantDepositTokenWithHook is CompliantDepositTokenWithHook, DeprecatedGasRefundPool {
    function _isBlacklisted(address _account) internal view returns (bool) {
        return registry.hasAttribute(_account, IS_BLACKLISTED);
    }

    function _requireCanTransfer(address _from, address _to) internal view returns (address, bool) {
        return ProvisionalRegistry(address(registry)).requireCanTransfer(_from, _to);
    }

    function _requireCanTransferFrom(address _sender, address _from, address _to) internal view returns (address, bool) {
        return ProvisionalRegistry(address(registry)).requireCanTransferFrom(_sender, _from, _to);
    }

    function _requireCanMint(address _to) internal view returns (address, bool) {
        return ProvisionalRegistry(address(registry)).requireCanMint(_to);
    }

    function _requireCanBurn(address _from) internal view {
        ProvisionalRegistry(address(registry)).requireCanBurn(_from);
    }
    function _requireOnlyCanBurn(address _from) internal view {
        ProvisionalRegistry(address(registry)).requireCanBurn(_from);
    }
    function migratedBalanceOf(address _who) public view returns (uint256) {
        return super._getBalance(_who);
    }
    function _getBalance(address _who) internal view returns (uint256) {
        return balances_Deprecated.balanceOf(_who);
    }
    function _addBalance(address _who, uint256 _value) internal returns (uint256 priorBalance) {
        priorBalance = _getBalance(_who);
        _setBalance(_who, priorBalance.add(_value));
    }
    function _subBalance(address _who, uint256 _value) internal returns (uint256 balanceNew) {
        balanceNew = _getBalance(_who).sub(_value);
        _setBalance(_who, balanceNew);
    }
    function _setBalance(address _who, uint256 _value) internal {
        balances_Deprecated.setBalance(_who, _value);
        super._setBalance(_who, _value);
    }

    function migrateBalances(address[] calldata holders) external retroGasRefund45 {
        uint256 i = holders.length;
        while (i --> 0) {
            address holder = holders[i];
            super._setBalance(holder, _getBalance(holder));
        }
    }

    function migrateAllowances(address[] calldata holders, address[] calldata spenders) external retroGasRefund45 {
        uint256 i = holders.length;
        while (i --> 0) {
            address holder = holders[i];
            address spender = spenders[i];
            super._setAllowance(holder, spender, _getAllowance(holder, spender));
        }
    }
    function migratedAllowance(address _who, address _spender) public view returns (uint256) {
        return super._getAllowance(_who, _spender);
    }
    function _getAllowance(address _who, address _spender) internal view returns (uint256) {
        return allowances_Deprecated.allowanceOf(_who, _spender);
    }
    function _addAllowance(address _who, address _spender, uint256 _value) internal {
        uint256 prior = _getAllowance(_who, _spender);
        _setAllowance(_who, _spender, prior.add(_value));
    }
    function _subAllowance(address _who, address _spender, uint256 _value) internal returns (uint256 updated) {
        uint256 prior = _getAllowance(_who, _spender);
        updated = prior.sub(_value);
        _setAllowance(_who, _spender, updated);
    }
    function _setAllowance(address _who, address _spender, uint256 _value) internal {
        super._setAllowance(_who, _spender, _value);
        allowances_Deprecated.setAllowance(_who, _spender, _value);
    }
}
