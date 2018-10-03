pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";
import "./utilities/AddressUtils.sol";

// This allows a token to treat transfer(0x0, value) as burn(value). This
// is useful for users of standard wallet programs which have transfer
// functionality built in but not the ability to burn.
contract RedeemToken is AddressUtils, ModularPausableToken {
    
    //a burn address is any address with the last 10 or more bytes (20 characters) equal 0
    //for exmaple 0x1bf0f9fbc23fff3bb6bb00000000000000000000 is a burn address
    //Transfer to any burn address is also treated as burn.
    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        if (_to == address(0)) {
            burnAllArgs(_from, _value, "");
        } else if (shortenAddress(_to) == _to) {
            super.transferAllArgs(_from, _to, _value);
            burnAllArgs(_to, _value, "");
        } else {
            super.transferAllArgs(_from, _to, _value);
        }
    }

    // StandardToken's transferFrom doesn't have to check for
    // _to != 0x0, but we do because we redirect 0x0 transfers to burns, but
    // we do not redirect transferFrom
    function transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        require(_to != address(0), "_to address is 0x0");
        super.transferFromAllArgs(_from, _to, _value, _spender);
    }
}
