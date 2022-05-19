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
        chainReserveHeartbeat = MAX_AGE;
    }

    /**
     * @notice Overriden mint function that checks the specified proof-of-reserves feed to
     * ensure that the total supply of this TrueCurrency is not greater than the reported
     * reserves.
     * @dev The proof-of-reserves check is bypassed if feed is not set.
     * @param account The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function _mint(address account, uint256 amount) internal virtual override {
        if (chainReserveFeed == address(0)) {
            super._mint(account, amount);
            return;
        }

        // Get latest proof-of-reserves from the feed
        (, int256 signedReserves, , uint256 updatedAt, ) = IChainlinkAggregatorV3(chainReserveFeed).latestRoundData();
        require(signedReserves > 0, "TrueCurrency: Invalid answer from PoR feed");
        uint256 reserves = uint256(signedReserves);

        // Check the answer is fresh enough (i.e., within the specified heartbeat)
        uint256 oldestAllowed = block.timestamp.sub(chainReserveHeartbeat, "TrueCurrency: Invalid timestamp from PoR feed");
        require(updatedAt >= oldestAllowed, "TrueCurrency: PoR answer too old");

        // Get required info about total supply & decimals
        uint256 currentSupply = totalSupply();
        uint8 trueDecimals = decimals();
        uint8 reserveDecimals = IChainlinkAggregatorV3(chainReserveFeed).decimals();
        // Normalise TrueCurrency & reserve decimals
        if (trueDecimals < reserveDecimals) {
            currentSupply = currentSupply.mul(10**uint256(reserveDecimals - trueDecimals));
        } else if (trueDecimals > reserveDecimals) {
            reserves = reserves.mul(10**uint256(trueDecimals - reserveDecimals));
        }

        // Check that after minting more tokens, the total supply would NOT exceed the reserves
        // reported by the latest valid proof-of-reserves feed.
        require(currentSupply + amount <= reserves, "TrueCurrency: total supply would exceed reserves after mint");
        super._mint(account, amount);
    }

    /**
     * @notice Sets a new feed address
     * @dev Admin function to set a new feed
     * @param newFeed Address of the new feed
     */
    function setChainReserveFeed(address newFeed) external override onlyOwner returns (uint256) {
        require(newFeed != chainReserveFeed, "TrueCurrency: new chainReserveFeed must be different to current feed");

        emit NewChainReserveFeed(chainReserveFeed, newFeed);
        chainReserveFeed = newFeed;
    }

    /**
     * @notice Sets the feed's heartbeat expectation
     * @dev Admin function to set the heartbeat
     * @param newHeartbeat Value of the age of the latest update from the feed
     */
    function setChainReserveHeartbeat(uint256 newHeartbeat) external override onlyOwner returns (uint256) {
        require(newHeartbeat <= MAX_AGE, "TrueCurrency: PoR heartbeat greater than MAX_AGE");

        // Allowable scenarios:
        //  - heartbeat is not initialised (0 instead of default MAX_AGE); OR
        //  - new heartbeat is different AND
        //    new heartbeat is not resetting to default while current heartbeat is already set to the default
        require(
            chainReserveHeartbeat == 0 ||
                (newHeartbeat != chainReserveHeartbeat && !(newHeartbeat == 0 && chainReserveHeartbeat == MAX_AGE)),
            "TrueCurrency: new chainReserveHeartbeat must be different to current heartbeat"
        );

        emit NewChainReserveHeartbeat(chainReserveHeartbeat, newHeartbeat);
        chainReserveHeartbeat = newHeartbeat == 0 ? MAX_AGE : newHeartbeat;
    }
}
