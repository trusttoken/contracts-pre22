// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrueCurrency} from "./TrueCurrency.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
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

    constructor() public {
        uint256 INITIAL_CHAIN_RESERVE_HEARTBEAT = 7 days;
        chainReserveHeartbeat = INITIAL_CHAIN_RESERVE_HEARTBEAT;
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
        (, int256 signedReserves, , uint256 updatedAt, ) = AggregatorV3Interface(chainReserveFeed).latestRoundData();
        require(signedReserves > 0, "TrueCurrency: Invalid answer from PoR feed");
        uint256 reserves = uint256(signedReserves);

        // Check the answer is fresh enough (i.e., within the specified heartbeat)
        uint256 oldestAllowed = block.timestamp.sub(chainReserveHeartbeat, "TrueCurrency: Invalid timestamp from PoR feed");
        require(updatedAt >= oldestAllowed, "TrueCurrency: PoR answer too old");

        // Get required info about total supply & decimals
        uint8 trueDecimals = decimals();
        uint8 reserveDecimals = AggregatorV3Interface(chainReserveFeed).decimals();
        uint256 currentSupply = totalSupply();
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
        if (newFeed != chainReserveFeed) {
            emit NewChainReserveFeed(chainReserveFeed, newFeed);
            chainReserveFeed = newFeed;
        }
    }

    /**
     * @notice Sets the feed's heartbeat expectation
     * @dev Admin function to set the heartbeat
     * @param newHeartbeat Value of the age of the latest update from the feed
     */
    function setChainReserveHeartbeat(uint256 newHeartbeat) external override onlyOwner returns (uint256) {
        if (newHeartbeat != chainReserveHeartbeat) {
            emit NewChainReserveHeartbeat(chainReserveHeartbeat, newHeartbeat);
            chainReserveHeartbeat = newHeartbeat;
        }
    }
}
