using ERC20 as token

methods {
    debt() returns uint256 envfree
    unpaidDebt() returns uint256 envfree

    token.balanceOf(address) returns uint256 envfree
    
    transfer(address, uint256) returns (bool) => DISPATCHER(true)
    transferFrom(address, address, uint256) returns (bool) => DISPATCHER(true)
    approve(address, uint256) returns (bool) => DISPATCHER(true)
    unlock(address) => DISPATCHER(true)
}

invariant debtNotGreaterThanSumOfBalanceAndUnpaidDebt()
    debt() <= token.balanceOf(currentContract) + unpaidDebt()
    filtered { f -> 
            f.selector != redeem().selector &&
            f.selector != initialize(address, address, address, address, address, address, address, uint256, uint256, uint256).selector 
    }
