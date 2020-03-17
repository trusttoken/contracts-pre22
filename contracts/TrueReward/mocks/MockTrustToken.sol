pragma solidity ^0.5.13;

import "../../../trusttokens/contracts/TrustToken.sol";

contract MockTrustToken is TrustToken {
    Registry registry_;

    constructor(Registry _registry) public {
        registry_ = _registry;
    }

    function registry() internal view returns (Registry) {
        return registry_;
    }
}
