// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IPoRToken {
    /**
     * @notice Event emitted when the feed is updated
     */
    event NewChainReserveFeed(address oldFeed, address newFeed);

    /**
     * @notice Event emitted when the heartbeat of chain reserve feed is updated
     */
    event NewChainReserveHeartbeat(uint256 oldHeartbeat, uint256 newHeartbeat);

    /*** Admin Functions ***/

    function setChainReserveFeed(address newFeed) external returns (uint256);

    function setChainReserveHeartbeat(uint256 newHeartbeat) external returns (uint256);
}
