pragma solidity 0.6.10;

import {Timelock} from "../Timelock.sol";

contract MockTimeLock is Timelock {
    /**
     * @dev Initialize sets the addresses of admin and the delay timestamp
     * @param admin_ The address of admin
     * @param delay_ The timestamp of delay for timelock contract
     */
    function mockInitialize(address admin_, uint256 delay_) external {
        require(!initalized, "Already initialized");
        admin = admin_;
        pauser = admin_;
        delay = delay_;

        owner_ = msg.sender;
        initalized = true;

        admin_initialized = true;
    }
}
