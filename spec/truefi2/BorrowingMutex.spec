methods {
    isUnlocked(address) returns bool envfree
    isBanned(address) returns bool envfree
}

definition isReasonableAddress(address alice) returns bool = alice != 0 && alice != 1;
definition isReasonableEnv(env e) returns bool = isReasonableAddress(e.msg.sender);

rule onePlusTwoEqualsThree(uint one, uint two) {
    require one == 1 && two == 2;

    uint three = one + two;

    assert three == 3, "One plus two does not equal three";
}

rule unlockedIntoBanned() {
    address borrower;
    require isReasonableAddress(borrower);
    require isUnlocked(borrower);

    method f;
    env e;
    require isReasonableEnv(e);
    calldataarg args;
    if (f.selector == lock(address, address).selector) {
        address locker;
        address lockee;
        require isReasonableAddress(locker);
        lock(e, lockee, locker);
    } else {
        sinvoke f(e, args);
    }

    assert !isBanned(borrower);
}
