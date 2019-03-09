pragma solidity ^0.4.23;

import "./CompliantDepositTokenWithHook.sol";
import "../registry/contracts/ProvisionalRegistry.sol";

// Supports balance and allowance migration at great cost
contract ProvisionalCompliantDepositTokenWithHook is CompliantDepositTokenWithHook {
    function _isBlacklisted(address _account) internal view returns (bool) {
        return registry.hasAttribute(_account, IS_BLACKLISTED);
    }

    function _requireCanTransfer(address _from, address _to) internal view returns (address, bool) {
        return ProvisionalRegistry(registry).requireCanTransfer(_from, _to);
    }

    function _requireCanTransferFrom(address _sender, address _from, address _to) internal view returns (address, bool) {
        return ProvisionalRegistry(registry).requireCanTransferFrom(_sender, _from, _to);
    }

    function _requireCanMint(address _to) internal view returns (address, bool) {
        return ProvisionalRegistry(registry).requireCanMint(_to);
    }

    function _requireCanBurn(address _from) internal view {
        ProvisionalRegistry(registry).requireCanBurn(_from);
    }
    function migratedBalanceOf(address _who) public view returns (uint256) {
        return _balanceOf[_who];
    }
    function _getBalance(address _who) internal view returns (uint256) {
        return balances.balanceOf(_who);
    }
    function _addBalance(address _who, uint256 _value) internal returns (bool balanceNew) {
        uint256 priorBalance = _getBalance(_who);
        _setBalance(_who, priorBalance.add(_value));
        balanceNew = priorBalance == 0;
    }
    function _subBalance(address _who, uint256 _value) internal returns (bool balanceZero) {
        uint256 balanceNew = _getBalance(_who).sub(_value);
        _setBalance(_who, balanceNew);
        balanceZero = balanceNew == 0;
    }
    function _setBalance(address _who, uint256 _value) internal {
        balances.setBalance(_who, _value);
        _balanceOf[_who] = _value;
    }

    modifier retroGasRefund45 {
        _;
        uint256 len = gasRefundPool_Deprecated.length;
        if (len > 2 && tx.gasprice > gasRefundPool_Deprecated[len-1]) {
            gasRefundPool_Deprecated.length = len - 3;
        }
    }

    function migrateBalances(address[] holders) external retroGasRefund45 {
        uint256 i = holders.length;
        while (i --> 0) {
            address holder = holders[i];
            _balanceOf[holder] = _getBalance(holder);
        }
    }

    function migrateAllowances(address[] holders, address[] spenders) external retroGasRefund45 {
        uint256 i = holders.length;
        while (i --> 0) {
            address holder = holders[i];
            address spender = spenders[i];
            _allowance[holder][spender] = _getAllowance(holder, spender);
        }
    }
    function migratedAllowance(address _who, address _spender) public view returns (uint256) {
        return _allowance[_who][_spender];
    }
    function _getAllowance(address _who, address _spender) internal view returns (uint256) {
        return allowances.allowanceOf(_who, _spender);
    }
    function _addAllowance(address _who, address _spender, uint256 _value) internal {
        uint256 prior = _getAllowance(_who, _spender);
        _setAllowance(_who, _spender, prior.add(_value)); 
    }
    function _subAllowance(address _who, address _spender, uint256 _value) internal returns (bool allowanceZero) {
        uint256 prior = _getAllowance(_who, _spender);
        uint256 updated = prior.sub(_value);
        _setAllowance(_who, _spender, updated); 
        allowanceZero = updated == 0;
    }
    function _setAllowance(address _who, address _spender, uint256 _value) internal {
        _allowance[_who][_spender] = _value;
        allowances.setAllowance(_who, _spender, _value);
    }
}
