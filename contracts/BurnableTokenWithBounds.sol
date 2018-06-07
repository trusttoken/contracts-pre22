pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";

//Burning functions as withdrawing money from the system. The platform will keep track of who burns coins,
//and will send them back the equivalent amount of money (rounded down to the nearest cent).
//The API for burning is inherited: burn(uint256 _value)
contract BurnableTokenWithBounds is ModularPausableToken {
    uint256 public burnMin = 0;
    uint256 public burnMax = 0;

    event SetBurnBounds(uint256 newMin, uint256 newMax);

    function burnAllArgs(address _burner, uint256 _value, string _note) internal {
        require(_value >= burnMin,"exceeds max burn bound");
        require(_value <= burnMax, "below min burn bound");
        super.burnAllArgs(_burner, _value, _note);
    }

    //Change the minimum and maximum amount that can be burned at once. Burning
    //may be disabled by setting both to 0 (this will not be done under normal
    //operation, but we can't add checks to disallow it without losing a lot of
    //flexibility since burning could also be as good as disabled
    //by setting the minimum extremely high, and we don't want to lock
    //in any particular cap for the minimum)
    function setBurnBounds(uint256 _min, uint256 _max) onlyOwner public {
        require(_min <= _max,"min > max");
        burnMin = _min;
        burnMax = _max;
        emit SetBurnBounds(_min, _max);
    }
}
