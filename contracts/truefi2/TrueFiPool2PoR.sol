// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {TrueFiPool2} from "./TrueFiPool2.sol";
import {IChainlinkAggregatorV3} from "../common/interface/IChainlinkAggregatorV3.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20} from "../common/UpgradeableERC20.sol";
import {IPoRToken} from "../common/interface/IPoRToken.sol";

/**
 * @title TrueFiPool2PoR
 * @dev Lending pool which inherits from TrueFiPool2.
 *  This contract implements an additional check against a Proof-of-Reserves feed before
 *  allowing tokens to be minted.
 */
contract TrueFiPool2PoR is TrueFiPool2, IPoRToken {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    uint256 public constant MAX_AGE = 7 days;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // ===========================================
    // This contract inherits TrueFiPool2, so
    // TrueFiPool2 storage is defined before this
    // contract's storage slot!
    // ===========================================

    address public feed;
    uint256 public heartbeat;

    // ======= STORAGE DECLARATION END ===========

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
        require(answer > 0, "TrueFiPool: Invalid answer from PoR feed");

        // Check the answer is fresh enough (i.e., within the specified heartbeat)
        uint256 oldestAllowed = block.timestamp.sub(heartbeat, "TrueFiPool: Invalid timestamp from PoR feed");
        require(updatedAt >= oldestAllowed, "TrueFiPool: PoR answer too old");

        // Get required info about underlying/reserves supply & decimals
        uint256 underlyingSupply = ERC20(token).totalSupply();
        uint8 underlyingDecimals = ERC20(token).decimals();
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
        require(underlyingSupply <= reserves, "TrueFiPool: underlying supply exceeds proof-of-reserves");
        super._mint(account, amount);
    }

    /**
     * @notice Sets a new feed address
     * @dev Admin function to set a new feed
     * @param newFeed Address of the new feed
     */
    function setFeed(address newFeed) external override onlyOwner returns (uint256) {
        require(newFeed != feed, "TrueFiPool: new feed must be different to current feed");

        emit NewFeed(feed, newFeed);
        feed = newFeed;

        if (heartbeat == 0) {
            // Set the heartbeat to a sane default (MAX_AGE) when setting a feed.
            // Necessary here as TrueFiPool2PoR inherits from an initializable contract and
            // does not have its own initializer/constructor.
            setHeartbeat(MAX_AGE);
        }
    }

    /**
     * @notice Sets the feed's heartbeat expectation
     * @dev Admin function to set the heartbeat
     * @param newHeartbeat Value of the age of the latest update from the feed
     */
    function setHeartbeat(uint256 newHeartbeat) public override onlyOwner returns (uint256) {
        require(newHeartbeat <= MAX_AGE, "TrueFiPool: PoR heartbeat greater than MAX_AGE");
        // Allowable scenarios:
        //  - heartbeat is not initialised (0 instead of default MAX_AGE); OR
        //  - new heartbeat is different AND
        //    new heartbeat is not resetting to default while current heartbeat is already set to the default
        require(
            heartbeat == 0 || (newHeartbeat != heartbeat && !(newHeartbeat == 0 && heartbeat == MAX_AGE)),
            "TrueFiPool: new heartbeat must be different to current heartbeat"
        );

        emit NewHeartbeat(heartbeat, newHeartbeat);
        heartbeat = newHeartbeat == 0 ? MAX_AGE : newHeartbeat;
    }
}
