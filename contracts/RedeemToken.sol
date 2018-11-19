pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";

// This allows a token to treat transfer(0x0, value) as burn(value). This
// is useful for users of standard wallet programs which have transfer
// functionality built in but not the ability to burn.
contract RedeemToken is ModularPausableToken {

}