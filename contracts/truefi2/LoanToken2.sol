// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {IContractWithPool, ITrueFiPool2} from "./interface/ILoanToken2.sol";
import {LoanToken} from "../truefi/LoanToken.sol";

/**
 * @title LoanToken V2
 * @dev A token which represents share of a debt obligation
 *
 * Each LoanToken has:
 * - borrower address
 * - borrow amount
 * - loan term
 * - loan APY
 *
 * Loan progresses through the following states:
 * Awaiting:    Waiting for funding to meet capital requirements
 * Funded:      Capital requirements met, borrower can withdraw
 * Withdrawn:   Borrower withdraws money, loan waiting to be repaid
 * Settled:     Loan has been paid back in full with interest
 * Defaulted:   Loan has not been paid back in full
 * Liquidated:  Loan has Defaulted and stakers have been Liquidated
 *
 * - LoanTokens are non-transferable except for whitelisted addresses
 * - This version of LoanToken only supports a single funder
 */
contract LoanToken2 is LoanToken, IContractWithPool {
    using SafeMath for uint256;

    ITrueFiPool2 public override pool;

    /**
     * @dev Create a Loan
     * @param _pool Pool to lend from
     * @param _borrower Borrower address
     * @param _amount Borrow amount of currency tokens
     * @param _term Loan length
     * @param _apy Loan APY
     */
    constructor(
        ITrueFiPool2 _pool,
        address _borrower,
        address _lender,
        address _liquidator,
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) public LoanToken(_pool.token(), _borrower, _lender, _liquidator, _amount, _term, _apy) {
        pool = _pool;
    }

    function version() external override pure returns (uint8) {
        return 4;
    }
}
