// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrency} from "./TrueCurrency.sol";
import {IChainlinkAggregatorV3} from "../common/interface/IChainlinkAggregatorV3.sol";
import {IPoRToken} from "../common/interface/IPoRToken.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title TrueCurrencyWithPoR
 * @dev TrueCurrencyPoR is an ERC20 with blacklist & redemption addresses.
 *  Please see TrueCurrency for the implementation that this contract inherits from.
 *  This contract implements an additional check against a Proof-of-Reserves feed before
 *  allowing tokens to be minted.
 */
abstract contract TrueCurrencyWithPoR is TrueCurrency, IPoRToken {
    using SafeMath for uint256;

    uint256 public constant MAX_AGE = 7 days;

    constructor() public {
        heartbeat = MAX_AGE;
    }

    /**
     * @notice Overriden mint function that checks the specified proof-of-reserves feed to
     * ensure that the supply of the underlying assets is not greater than the reported
     * reserves.
     * @dev The proof-of-reserves check is bypassed if feed is not set.
     * @param account The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function _mint(address account, uint256 amount) internal virtual override {
        if (feed == address(0)) {
            super._mint(account, amount);
            return;
        }

        // Get latest proof-of-reserves from the feed
        (, int256 answer, , uint256 updatedAt, ) = IChainlinkAggregatorV3(feed).latestRoundData();
        require(answer > 0, "TrueCurrency: Invalid answer from PoR feed");

        // Check the answer is fresh enough (i.e., within the specified heartbeat)
        uint256 oldestAllowed = block.timestamp.sub(heartbeat, "TrueCurrency: Invalid timestamp from PoR feed");
        require(updatedAt >= oldestAllowed, "TrueCurrency: PoR answer too old");

        // Get required info about underlying/reserves supply & decimals
        uint256 underlyingSupply = totalSupply();
        uint8 underlyingDecimals = decimals();
        uint8 reserveDecimals = IChainlinkAggregatorV3(feed).decimals();
        uint256 reserves = uint256(answer);
        // Normalise underlying & reserve decimals
        if (underlyingDecimals < reserveDecimals) {
            underlyingSupply = underlyingSupply.mul(10**uint256(reserveDecimals - underlyingDecimals));
        } else if (underlyingDecimals > reserveDecimals) {
            reserves = reserves.mul(10**uint256(underlyingDecimals - reserveDecimals));
        }

        // Check that the supply of underlying tokens is NOT greater than the supply
        // provided by the latest valid proof-of-reserves.
        require(underlyingSupply <= reserves, "TrueCurrency: underlying supply exceeds proof-of-reserves");
        super._mint(account, amount);
    }

    /**
     * @notice Sets a new feed address
     * @dev Admin function to set a new feed
     * @param newFeed Address of the new feed
     */
    function setFeed(address newFeed) external override onlyOwner returns (uint256) {
        emit NewFeed(feed, newFeed);
        feed = newFeed;
    }

    /**
     * @notice Sets the feed's heartbeat expectation
     * @dev Admin function to set the heartbeat
     * @param newHeartbeat Value of the age of the latest update from the feed
     */
    function setHeartbeat(uint256 newHeartbeat) external override onlyOwner returns (uint256) {
        require(newHeartbeat <= MAX_AGE, "TrueCurrency: PoR heartbeat greater than MAX_AGE");

        emit NewHeartbeat(heartbeat, newHeartbeat);
        heartbeat = newHeartbeat == 0 ? MAX_AGE : newHeartbeat;
    }
}
