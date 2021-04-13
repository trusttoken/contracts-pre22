// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Timelock} from "../Timelock.sol";
import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";

contract MockTimeLock is Timelock {
    /**
     * @dev Initialize sets the addresses of admin and the delay timestamp
     * @param admin_ The address of admin
     * @param delay_ The timestamp of delay for timelock contract
     */
    function mockInitialize(address admin_, uint256 delay_) external {
        UpgradeableClaimable.initialize(msg.sender);
        admin = admin_;
        pauser = admin_;
        delay = delay_;
    }

    /**
     * @dev Function to set delay for testing
     * @param _delay new delay
     */
    function mockSetDelay(uint256 _delay) external {
        delay = _delay;
    }
}
