// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IDEXFundsAllocation} from "./IDEXFundsAllocation.sol";
import {ClaimableOwnable} from "../ClaimableOwnable.sol";

/**
 * Distribute TUSD to IDEX trading accounts with stuck funds
 */
contract DistributeIDEXFunds is IDEXFundsAllocation, ClaimableOwnable {
    using SafeMath for uint256;
    IERC20 tusd = IERC20(0x0000000000085d4780B73119b644AE5ecd22b376);
    uint256 round;
    uint256 constant ROUND_SIZE = 100;

    /**
     * @dev loop through funds allocation and distribute
     * ~32213 gas per transfer
     * Distribute in rounds to avoid block gas limit
     * Start of round
     */
    function distribute() public onlyOwner {
        // (round + 1) * (ROUND_SIZE)
        uint256 roundMax = round.add(1).mul(ROUND_SIZE);

        // loop & transfer balance
        for (uint256 index = round.mul(ROUND_SIZE); index < DISTRIBUTION_SIZE && index < roundMax; index++) {
            // ~32213 gas per transfer
            tusd.transfer(accounts[index], balances[index]);
        }
        round++;
    }

    /**
     * @dev get balance for an account
     */
    function distribution(uint256 index) public view returns (address, uint256) {
        return (accounts[index], balances[index]);
    }
}
