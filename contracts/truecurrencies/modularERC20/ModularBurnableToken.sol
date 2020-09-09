// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ModularStandardToken} from "./ModularStandardToken.sol";

/**
 * @title Burnable Token
 * @dev Token that can be irreversibly burned (destroyed).
 */
contract ModularBurnableToken is ModularStandardToken {
    event Burn(address indexed burner, uint256 value);
    event Mint(address indexed to, uint256 value);
    uint256 constant CENT = 10**16;

    /**
     * @dev Burn caller's tokens rounded to cents
     */
    function burn(uint256 _value) external {
        _burnAllArgs(msg.sender, _value - (_value % CENT));
    }

    /**
     * @dev See burn
     */
    function _burnAllArgs(address _from, uint256 _value) internal virtual {
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure
        _subBalance(_from, _value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_from, _value);
        emit Transfer(_from, address(0), _value);
    }
}
