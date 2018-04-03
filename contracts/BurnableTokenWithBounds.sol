pragma solidity ^0.4.18;

import "../zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";

//Burning functions as withdrawing money from the system. The platform will keep track of who burns coins,
//and will send them back the equivalent amount of money (rounded down to the nearest cent).
//The API for burning is inherited: burn(uint256 _value)
contract BurnableTokenWithBounds is BurnableToken {
    uint256 public burnMin = 0;
    uint256 public burnMax = 0;

    event ChangeBurnBoundsEvent(uint256 newMin, uint256 newMax);

    function burnAllArgs(address burner, uint256 _value) internal {
        require(_value >= burnMin);
        require(_value <= burnMax);
        super.burnAllArgs(burner, _value);
    }

    //Change the minimum and maximum amount that can be burned at once. Burning
    //may be disabled by setting both to 0 (this will not be done under normal
    //operation, but we can't add checks to disallow it without losing a lot of
    //flexibility since burning could also be as good as disabled
    //by setting the minimum extremely high, and we don't want to lock
    //in any particular cap for the minimum)
    function changeBurnBounds(uint256 newMin, uint256 newMax) onlyOwner public {
        require(newMin <= newMax);
        burnMin = newMin;
        burnMax = newMax;
        ChangeBurnBoundsEvent(newMin, newMax);
    }
}
