pragma solidity ^0.5.13;

import "../../contracts/StakingAsset.sol";
import "../AssuranceOppurtunity.sol";

contract MockAssuranceOppurtunity is AssuranceOppurtunity {
    StakedToken pool_;

    constructor(StakedToken _pool) public {
        pool_ = _pool
        initialize();
    }

    function pool() internal view returns (StakedToken) {
        return pool_;
    }
}
