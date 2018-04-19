pragma solidity ^0.4.21;

import "./ModularBasicToken.sol";

/**
 * @title Burnable Token
 * @dev Token that can be irreversibly burned (destroyed).
 */
contract ModularBurnableToken is ModularBasicToken {
    event Burn(address indexed burner, uint256 value);

    /**
     * @dev Burns a specific amount of tokens.
     * @param _value The amount of token to be burned.
     */
    function burn(uint256 _value) public {
        burnAllArgs(msg.sender, _value);
    }

    function burnAllArgs(address _burner, uint256 _value) internal {
        require(_value <= balances.balanceOf(_burner));
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure

        balances.subBalance(_burner, _value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_burner, _value);
        emit Transfer(_burner, address(0), _value);
    }
}
