pragma solidity^0.4.23;

import "../ProvisionalTrueUSD.sol";

// Mocks the behavior from before balances were migrated
contract PreMigrationTrueUSDMock is ProvisionalTrueUSD {
    function _addBalance(address _who, uint256 _value) internal {
        balances.addBalance(_who, _value);
    }
    function _subBalance(address _who, uint256 _value) internal {
        balances.subBalance(_who, _value);
    }
    function _setBalance(address _who, uint256 _value) internal {
        balances.setBalance(_who, _value);
    }
    function _addAllowance(address _who, address _spender, uint256 _value) internal {
        allowances.addAllowance(_who, _spender, _value);
    }
    function _subAllowance(address _who, address _spender, uint256 _value) internal {
        allowances.subAllowance(_who, _spender, _value);
    }
    function _setAllowance(address _who, address _spender, uint256 _value) internal {
        allowances.setAllowance(_who, _spender, _value);
    }
}
