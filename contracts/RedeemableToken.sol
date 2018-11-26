pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";

/** @title Redeemable Token 
Makes transfers to 0x0 alias to Burn
Implement Redemption Addresses
*/
contract RedeemableToken is ModularPausableToken {

    event RedemptionAddress(address indexed addr);

    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        if (_to == address(0)) {
            // transfer to 0x0 becomes burn
            burnAllArgs(_from, _value);
        } else if (uint(_to) <= redemptionAddressCount) {
            // Trnasfers to redemption addresses becomes burn
            super.transferAllArgs(_from, _to, _value);
            burnAllArgs(_to, _value);
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

    function incrementRedemptionAddressCount() external onlyOwner {
        emit RedemptionAddress(address(redemptionAddressCount));
        redemptionAddressCount += 1;
    }
}
