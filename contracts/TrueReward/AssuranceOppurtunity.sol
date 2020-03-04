pragma solidity ^0.5.13;

import "../../StakingAsset.sol";

/**
  * Assurance Oppurtunity handles liqudiation and reward deposits.
  * All Financial Oppurtunities are Assurance Oppurtunities.
**/
contract AssuranceOppurtunity {

	/** StakedToken is TrustToken staking pool **/
	function pool() internal view returns (StakedToken);

	/** Deposit reward into staking pool **/
    function deposit(uint _amount) external {
    	pool().deposit(_amount);
    }

    /** Liquidate some amount of staked token and return value in staking asset to sender **/
    function liquidate(address _reciever, uint _amount) internal {
    	// amount in TUSD
    	pool().liquidator().reclaim(_reciever, _amount);
    }
}