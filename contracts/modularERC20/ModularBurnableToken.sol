pragma solidity ^0.4.18;

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

  function burnAllArgs(address burner, uint256 _value) internal {
    require(_value <= balances.balanceOf(burner));
    // no need to require value <= totalSupply, since that would imply the
    // sender's balance is greater than the totalSupply, which *should* be an assertion failure

    balances.subBalance(burner, _value);
    totalSupply_ = totalSupply_.sub(_value);
    Burn(burner, _value);
    Transfer(burner, address(0), _value);
  }
}
