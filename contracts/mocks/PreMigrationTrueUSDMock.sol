pragma solidity^0.4.23;

import "../ProvisionalTrueUSD.sol";

// Mocks the behavior from before balances were migrated
contract PreMigrationTrueUSDMock is ProvisionalTrueUSD {
    function _addBalance(address _who, uint256 _value) internal returns (bool) {
        balances.addBalance(_who, _value);
        return true;
    }
    function _subBalance(address _who, uint256 _value) internal returns (bool) {
        balances.subBalance(_who, _value);
        return true;
    }
    function _setBalance(address _who, uint256 _value) internal {
        balances.setBalance(_who, _value);
    }
    function _addAllowance(address _who, address _spender, uint256 _value) internal {
        allowances.addAllowance(_who, _spender, _value);
    }
    function _subAllowance(address _who, address _spender, uint256 _value) internal returns (bool) {
        allowances.subAllowance(_who, _spender, _value);
        return true;
    }
    function _setAllowance(address _who, address _spender, uint256 _value) internal {
        allowances.setAllowance(_who, _spender, _value);
    }
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        _setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
        initialize();
    }
    function initialize() public {
        require(!initialized, "already initialized");
        if (address(balances) == address(0x0)) {
            balances = new BalanceSheet();
        }
        if (address(allowances) == address(0x0)) {
            allowances = new AllowanceSheet();
        }
        initialized = true;
        owner = msg.sender;
        burnMin = 10000 * 10**uint256(DECIMALS);
        burnMax = 20000000 * 10**uint256(DECIMALS);
    }
    function setTotalSupply(uint _totalSupply) public onlyOwner {
        require(totalSupply_ == 0);
        totalSupply_ = _totalSupply;
    }
    function sponsorGas() external {
        uint256 refundPrice = minimumGasPriceForFutureRefunds;
        require(refundPrice > 0);
        uint256 len = gasRefundPool_Deprecated.length;
        gasRefundPool_Deprecated.length = len + 9;
        gasRefundPool_Deprecated[len] = refundPrice;
        gasRefundPool_Deprecated[len + 1] = refundPrice;
        gasRefundPool_Deprecated[len + 2] = refundPrice;
        gasRefundPool_Deprecated[len + 3] = refundPrice;
        gasRefundPool_Deprecated[len + 4] = refundPrice;
        gasRefundPool_Deprecated[len + 5] = refundPrice;
        gasRefundPool_Deprecated[len + 6] = refundPrice;
        gasRefundPool_Deprecated[len + 7] = refundPrice;
        gasRefundPool_Deprecated[len + 8] = refundPrice;
    }
    function gasRefund15() internal {
        uint256 len = gasRefundPool_Deprecated.length;
        if (len > 0 && gasRefundPool_Deprecated[len - 1] < tx.gasprice) {
            gasRefundPool_Deprecated.length = len - 1;
        }
    }
    function gasRefund30() internal {
        uint256 len = gasRefundPool_Deprecated.length;
        if (len > 1 && gasRefundPool_Deprecated[len - 1] < tx.gasprice) {
            gasRefundPool_Deprecated.length = len - 2;
        }
    }
    function gasRefund45() internal {
        uint256 len = gasRefundPool_Deprecated.length;
        if (len > 2 && gasRefundPool_Deprecated[len - 1] < tx.gasprice) {
            gasRefundPool_Deprecated.length = len - 3;
        }
    }
    function remainingGasRefundPool() public view returns (uint256) {
        return gasRefundPool_Deprecated.length;
    }
}
