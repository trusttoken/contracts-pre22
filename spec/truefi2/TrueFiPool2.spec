methods {

}

rule onePlusTwoEqualsThree(uint one, uint two) {
    require one == 1 && two == 2;

    uint three = one + two;

    assert three == 3, "One plus two does not equal three";
}