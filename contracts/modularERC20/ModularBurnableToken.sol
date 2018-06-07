pragma solidity ^0.4.23;

import "./ModularStandardToken.sol";

/**
 * @title Burnable Token
 * @dev Token that can be irreversibly burned (destroyed).
 */
contract ModularBurnableToken is ModularStandardToken {
    event Burn(address indexed burner, uint256 value, string note);

    /**
     * @dev Burns a specific amount of tokens.
     * @param _value The amount of token to be burned.
     * @param _note a note that burner can attach.
     */
    function burn(uint256 _value, string _note) public returns(bool) {
        burnAllArgs(msg.sender, _value, _note);
        return true;
    }

    function burnAllArgs(address _burner, uint256 _value, string _note) internal {
        require(_value <= balances.balanceOf(_burner),"not enough balance to burn");
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure
        /* uint burnAmount = _value / (10 **16) * (10 **16); */
        balances.subBalance(_burner, _value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_burner, _value, _note);
        emit Transfer(_burner, address(0), _value);
    }
}
