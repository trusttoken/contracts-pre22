// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../TrueUSD.sol";

contract TrueUSDMock is TrueUSD {
    constructor(address initialAccount, uint256 initialBalance) public {
        _setBalance(initialAccount, initialBalance);
        totalSupply_ = initialBalance;
        initialize();
    }

    function initialize() public {
        require(!initialized, "already initialized");
        initialized = true;
        owner = msg.sender;
        burnMin = 10000 * 10**uint256(DECIMALS);
        burnMax = 20000000 * 10**uint256(DECIMALS);
    }

    function setTotalSupply(uint256 _totalSupply) public onlyOwner {
        require(totalSupply_ == 0);
        totalSupply_ = _totalSupply;
    }

    address delegateFrom;

    function setDelegateFrom(address _delegateFrom) external {
        delegateFrom = _delegateFrom;
    }

    modifier onlyDelegateFrom() override {
        require(msg.sender == delegateFrom);
        _;
    }
}
