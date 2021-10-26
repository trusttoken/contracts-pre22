// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ITrueFiPool2PoR is ITrueFiPool2 {
    /**
     * @notice Event emitted when the feed is updated
     */
    event NewFeed(address oldFeed, address newFeed);

    /**
     * @notice Event emitted when the heartbeat of a feed is updated
     */
    event NewHeartbeat(uint256 oldHeartbeat, uint256 newHeartbeat);

    /*** Admin Functions ***/

    function setFeed(address newFeed) external returns (uint256);

    function setHeartbeat(uint256 newHeartbeat) external returns (uint256);
}
