pragma solidity ^0.4.23;

import "../TrueUSD.sol";

contract TrueUSDMock is TrueUSD {
    constructor(address initialAccount, uint256 initialBalance) public {
        balances = new BalanceSheet();
        allowances = new AllowanceSheet();
        balances.setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
        initialize();
    }

    function initialize() public {
        require(!initialized, "already initialized");
        initialized = true;
        owner = msg.sender;
        burnMin = 10000 * 10**uint256(DECIMALS);
        burnMax = 20000000 * 10**uint256(DECIMALS);
        name = "TrueUSD";
        symbol = "TUSD";
    }

    function setTotalSupply(uint _totalSupply) public onlyOwner {
        require(totalSupply_ == 0);
        totalSupply_ = _totalSupply;
    }
}
