methods {
    isUnlocked(address) returns bool envfree
    isBanned(address) returns bool envfree
    locker(address) returns address envfree
}

definition isReasonableAddress(address alice) returns bool = alice != 0 && alice != 1;
definition isReasonableEnv(env e) returns bool = isReasonableAddress(e.msg.sender);

function anyReasonableAddress() returns address {
    address alice;
    havoc alice;
    require isReasonableAddress(alice);
    return alice;
}

rule onePlusTwoEqualsThree(uint one, uint two) {
    require one == 1 && two == 2;

    uint three = one + two;

    assert three == 3, "One plus two does not equal three";
}

rule functionDoesNotBanUnlockedBorrower(method f) {
    address borrower;
    require isUnlocked(borrower);

    env e;
    require isReasonableEnv(e);
    calldataarg args;
    if (f.selector == lock(address, address).selector) {
        address locker = anyReasonableAddress();
        address lockee;
        lock(e, lockee, locker);
    } else {
        f(e, args);
    }

    assert !isBanned(borrower), "Borrower's status changes from unlocked to banned directly";
}

rule functionDoesNotUnbanBorrower(method f) {
    address borrower;
    require isBanned(borrower);

    env e;
    require isReasonableEnv(e);
    calldataarg args;
    f(e, args);

    assert isBanned(borrower), "Borrower gets unbanned";
}

rule onlyLockerCanBanBorrower(method f) {
    address borrower;
    address lockerAddress = anyReasonableAddress();
    require locker(borrower) == lockerAddress;

    env e;
    require isReasonableEnv(e);
    calldataarg args;
    f(e, args);

    assert isBanned(borrower) => e.msg.sender == lockerAddress, "Borrower gets banned by non-locker address";
}

rule onlyLockerCanUnlockBorrower(method f) {
    address borrower;
    address lockerAddress = anyReasonableAddress();
    require locker(borrower) == lockerAddress;

    env e;
    require isReasonableEnv(e);
    calldataarg args;
    f(e, args);

    assert isUnlocked(borrower) => e.msg.sender == lockerAddress, "Borrower gets unlocked by non-locker address";
}
