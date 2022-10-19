// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface IProofOfReserveToken {
    /*** Admin Functions ***/

    function setChainReserveFeed(address newFeed) external;

    function setChainReserveHeartbeat(uint256 newHeartbeat) external;

    function enableProofOfReserve() external;

    function disableProofOfReserve() external;

    /*** Events ***/

    /**
     * @notice Event emitted when the feed is updated
     */
    event NewChainReserveFeed(address oldFeed, address newFeed);

    /**
     * @notice Event emitted when the heartbeat of chain reserve feed is updated
     */
    event NewChainReserveHeartbeat(uint256 oldHeartbeat, uint256 newHeartbeat);

    /**
     * @notice Event emitted when Proof of Reserve is enabled
     */
    event ProofOfReserveEnabled();

    /**
     * @notice Event emitted when Proof of Reserve is disabled
     */
    event ProofOfReserveDisabled();
}
