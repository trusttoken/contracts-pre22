// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {TrustToken} from "../TrustToken.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

/**
 * @title MockTrustToken
 * @dev The TrustToken contract is a claimable contract where the
 * owner can only mint or transfer ownership. TrustTokens use 8 decimals
 * in order to prevent rewards from getting stuck in the remainder on division.
 * Tolerates dilution to slash stake and accept rewards.
 */
// prettier-ignore
contract MockTrustToken is TrustToken {
    using SafeMath for uint256;

    // last time faucet was called
    bytes32 private constant stampPosition = 0x2f28007de92226a28af88f681cdc4b6f1674637db295a37f849bd7dee6c8254c; // keccak256(abi.encode(truefi.mock));
    uint256 constant MAX_FAUCET = 1000000000000;
    uint256 constant DURATION = 1 minutes;

    /**
     * @dev facuet for testnet TRU
     * Can never mint more than MAX_SUPPLY = 1.45 billion
     * Set duration above 0 for block delays
     * @param to address to mint tokens for
     * @param amount amount of tokens to mint
     */
    function faucet(address to, uint256 amount) public {
        require(getStamp().add(DURATION) <= block.timestamp,
            "can only call faucet once per minute");
        require(amount <= MAX_FAUCET, 
            "amount exceeds max faucet amount per transaction");

        setStamp(block.timestamp);
        require(totalSupply.add(amount) <= MAX_SUPPLY,
            "Max Supply Exceeded");
            _mint(to, amount);
    }

    /**
     * @dev facuet for testnet TRU owner
     * Can never mint more than MAX_SUPPLY = 1.45 billion
     * Set duration above 0 for block delays
     * @param to address to mint tokens for
     * @param amount amount of tokens to mint
     */
    function ownerFaucet(address to, uint256 amount) public onlyOwner {
        require(totalSupply.add(amount) <= MAX_SUPPLY,
            "Max Supply Exceeded");
            _mint(to, amount);
    }

    /**
     * @dev get last timestamp TRU was minted
     * @return stamp timestamp when last TRU was minted
     */
    function getStamp() public view returns (uint256 stamp) {
        bytes32 position = stampPosition;
        assembly {
            stamp := sload(position)
        }
    }

    /**
     * @dev store last timestamp TRU was minted
     */
    function setStamp(uint256 stamp) internal {
        bytes32 position = stampPosition;
        assembly {
            sstore(position, stamp)
        }
    }
}