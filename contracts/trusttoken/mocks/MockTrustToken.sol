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
contract MockTrustToken is TrustToken {
    using SafeMath for uint256;

    mapping(address=>uint256) faucets;
    uint256 constant MAX_FAUCET = 100000000000;
    uint256 constant DURATION = 0 seconds;

    /**
     * @dev facuet for testnet TRU
     * Can never mint more than MAX_SUPPLY = 1.45 billion
     * Set duration above 0 for block delays
     */
    function facuet(address to, uint256 amount) public {
        require(faucets[msg.sender].add(DURATION) <= block.timestamp,
            "can only call faucet once per minute");
        require(amount <= MAX_FAUCET, 
            "amount exceeds maximum of 100000000000");
        require(totalSupply.add(amount) <= MAX_SUPPLY,
            "Max Supply Exceeded");
            _mint(to, amount);
    }
}
