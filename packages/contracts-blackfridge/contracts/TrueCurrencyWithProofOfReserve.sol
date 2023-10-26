// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {TrueCurrency} from "./TrueCurrency.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.6/interfaces/AggregatorV3Interface.sol";
import {IProofOfReserveToken} from "./interface/IProofOfReserveToken.sol";
import {SafeMath} from "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TrueCurrencyWithProofOfReserve
 * @dev TrueCurrencyWithProofOfReserve is an ERC20 with blacklist & redemption addresses.
 *  Please see TrueCurrency for the implementation that this contract inherits from.
 *  This contract implements an additional check against a Proof-of-Reserves feed before
 *  allowing tokens to be minted.
 */
abstract contract TrueCurrencyWithProofOfReserve is TrueCurrency, IProofOfReserveToken {
    using SafeMath for uint256;

    /**
     * @notice Overriden mint function that checks the specified proof-of-reserves feed to
     * ensure that the total supply of this TrueCurrency is not greater than the reported
     * reserves.
     * @dev The proof-of-reserves check is bypassed if feed is not set.
     * @param account The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function _mint(address account, uint256 amount) internal virtual override {
        if (chainReserveFeed == address(0) || !proofOfReserveEnabled) {
            super._mint(account, amount);
            return;
        }
        // Get required info about decimals.
        // Decimals of the Proof of Reserve feed must be the same as the token's.
        require(decimals() == AggregatorV3Interface(chainReserveFeed).decimals(), "TrueCurrency: Unexpected decimals of PoR feed");

        // Get latest proof-of-reserves from the feed
        (, int256 signedReserves, , uint256 updatedAt, ) = AggregatorV3Interface(chainReserveFeed).latestRoundData();
        require(signedReserves > 0, "TrueCurrency: Invalid answer from PoR feed");
        uint256 reserves = uint256(signedReserves);

        // Sanity check: is chainlink answer updatedAt in the past
        require(block.timestamp >= updatedAt, "TrueCurrency: invalid PoR updatedAt");

        // Check the answer is fresh enough (i.e., within the specified heartbeat)
        require(block.timestamp.sub(updatedAt) <= chainReserveHeartbeat, "TrueCurrency: PoR answer too old");

        // Get required info about total supply.
        // Check that after minting more tokens, the total supply would NOT exceed the reserves
        // reported by the latest valid proof-of-reserves feed.
        require(totalSupply() + amount <= reserves, "TrueCurrency: total supply would exceed reserves after mint");
        super._mint(account, amount);
    }

    /**
     * @notice Sets a new feed address
     * @dev Admin function to set a new feed
     * @param newFeed Address of the new feed
     */
    function setChainReserveFeed(address newFeed) external override onlyOwner {
        emit NewChainReserveFeed(chainReserveFeed, newFeed);
        chainReserveFeed = newFeed;
        if (newFeed == address(0)) {
            proofOfReserveEnabled = false;
            emit ProofOfReserveDisabled();
        }
    }

    /**
     * @notice Sets the feed's heartbeat expectation
     * @dev Admin function to set the heartbeat
     * @param newHeartbeat Value of the age of the latest update from the feed
     */
    function setChainReserveHeartbeat(uint256 newHeartbeat) external override onlyOwner {
        emit NewChainReserveHeartbeat(chainReserveHeartbeat, newHeartbeat);
        chainReserveHeartbeat = newHeartbeat;
    }

    /**
     * @notice Disable Proof of Reserve check
     * @dev Admin function to disable Proof of Reserve
     */
    function disableProofOfReserve() external override onlyOwner {
        proofOfReserveEnabled = false;
        emit ProofOfReserveDisabled();
    }

    /**
     * @notice Enable Proof of Reserve check
     * @dev Admin function to enable Proof of Reserve
     */
    function enableProofOfReserve() external override onlyOwner {
        require(chainReserveFeed != address(0), "TrueCurrency: chainReserveFeed not set");
        require(chainReserveHeartbeat != 0, "TrueCurrency: chainReserveHeartbeat not set");
        proofOfReserveEnabled = true;
        emit ProofOfReserveEnabled();
    }
}
