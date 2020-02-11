pragma solidity^0.5.13;

import "../ProvisionalTrueUSD.sol";

// Mocks the behavior from before balances were migrated
contract PreMigrationTrueUSDMock is ProvisionalTrueUSD {
    function _addBalance(address _who, uint256 _value) internal returns (uint256) {
        balances_Deprecated.addBalance(_who, _value);
        return 1;
    }
    function _subBalance(address _who, uint256 _value) internal returns (uint256 newBalance) {
        balances_Deprecated.subBalance(_who, _value);
        return 1;
    }
    function _setBalance(address _who, uint256 _value) internal {
        balances_Deprecated.setBalance(_who, _value);
    }
    function _addAllowance(address _who, address _spender, uint256 _value) internal {
        allowances_Deprecated.addAllowance(_who, _spender, _value);
    }
    function _subAllowance(address _who, address _spender, uint256 _value) internal returns (uint256) {
        allowances_Deprecated.subAllowance(_who, _spender, _value);
        return 0;
    }
    function _setAllowance(address _who, address _spender, uint256 _value) internal {
        allowances_Deprecated.setAllowance(_who, _spender, _value);
    }
    constructor(address initialAccount, uint256 initialBalance) public {
        balances_Deprecated = new BalanceSheet();
        allowances_Deprecated = new AllowanceSheet();
        _setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
        initialize();
    }
    function initialize() public {
        require(!initialized, "already initialized");
        if (address(balances_Deprecated) == address(0x0)) {
            balances_Deprecated = new BalanceSheet();
        }
        if (address(allowances_Deprecated) == address(0x0)) {
            allowances_Deprecated = new AllowanceSheet();
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
    function sponsorGas() external retroSponsorGas {
    }
    function gasRefund15() internal retroGasRefund15 {
    }
    function gasRefund30() internal retroGasRefund30 {
    }
    function gasRefund39() internal retroGasRefund45 {
    }
    function remainingGasRefundPool() public view returns (uint256) {
        return retroGasPoolRemaining();
    }
    function allowances() public view returns (AllowanceSheet) {
        return allowances_Deprecated;
    }
    function balances() public view returns (BalanceSheet) {
        return balances_Deprecated;
    }
    event AllowanceSheetSet(address indexed sheet);
    /**
    * @dev claim ownership of the AllowanceSheet contract
    * @param _sheet The address to of the AllowanceSheet to claim.
    */
    function setAllowanceSheet(address _sheet) public onlyOwner returns(bool) {
        allowances_Deprecated = AllowanceSheet(_sheet);
        allowances_Deprecated.claimOwnership();
        emit AllowanceSheetSet(_sheet);
        return true;
    }
    event BalanceSheetSet(address indexed sheet);
    /**
    * @dev claim ownership of the balancesheet contract
    * @param _sheet The address to of the balancesheet to claim.
    */
    function setBalanceSheet(address _sheet) public onlyOwner returns (bool) {
        balances_Deprecated = BalanceSheet(_sheet);
        balances_Deprecated.claimOwnership();
        emit BalanceSheetSet(_sheet);
        return true;
    }
}
