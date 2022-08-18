
methods {
    balanceOf(address) returns uint256 envfree
    chainReserveFeed() returns address envfree
    owner() returns address envfree
    totalSupply() returns uint256 envfree
}

rule mintCanAlwaysBeCalled() {
    address account; uint256 amount;

    env e;
    require account > 0x100000;
    require !isBlacklistedGhost[account];
    require e.msg.sender == owner();
    require e.msg.value == 0;
    require amount + balanceOf(account) <= max_uint256;
    require amount + totalSupply() <= max_uint256;
    require chainReserveFeed() == 0; // This can be set by owner, proved in following rule
    mint@withrevert(e, account, amount);

    assert !lastReverted;
}

rule chainReserveFeedCanBeSetByOwner() {
    address chainReserveFeed;

    env e;
    require e.msg.sender == owner();
    require e.msg.value == 0;
    setChainReserveFeed@withrevert(e, chainReserveFeed);

    assert chainReserveFeed() == chainReserveFeed;
}

ghost mapping(address => bool) isBlacklistedGhost;

hook Sstore isBlacklisted[KEY address account] bool value STORAGE {
    isBlacklistedGhost[account] = value;
}

hook Sload bool value isBlacklisted[KEY address account] STORAGE {
    require value == isBlacklistedGhost[account];
}
