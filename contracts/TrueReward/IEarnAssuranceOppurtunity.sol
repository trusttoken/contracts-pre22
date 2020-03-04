pragma solidity ^0.5.13;

import "../../StakingAsset.sol";

/** Assurance Oppurtunity for IEarn. Uses hardcoded assurance pool address. **/
contract IEarnAssuranceOppurtunity is AssuranceOppurtunity {

	// staking pool address
	address public constant IEARN_ASSURANCE_POOL_ADDRESS = 0x0000000000000000000000000000000000000000;

	/** StakedToken is assurance pool **/
	function pool() internal view returns (StakingAsset) {
		return StakedToken(IEARN_ASSURANCE_POOL_ADDRESS);
	}
}