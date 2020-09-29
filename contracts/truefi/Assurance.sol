pragma solidity ^0.6.10;

import {ILoanToken} from "./LoanToken.sol";

/**
 * @title Assurance
 * Prediction market to rate the risk of a loan.
 */
abstract contract Assurance {
    // store loan data
    struct Loan {
        address token;      // LoanToken address
        address borrower;   // borrower address
        uint256 yes;        // votes for
        uint256 no;         // votes against
        uint256 reward;     // trusttoken reward
        uint256 amount;     // loan amount
        uint256 term;       // loan term
        uint256 rate;       // loan APR
        uint256 end;        // voting period end
    }

    // paramaters
    uint256 fee;            // fee for applying
    uint256 lose;           // % TRU lost for losing vote
    uint256 burn;           // % TRU burned for losing vote
    uint256 partipation;    // TRU participation factor
    uint256 window;         // length of time for voting
    address tru;            // trusttoken

    // store loans in mapping
    mapping(address => Loan) loans;

    // emitted when someone votes
    event Vote(uint256 indexed account, uint256 indexed id, uint256 indexed amount, uint256 decision);

    // emitted when someone revokes a vote
    event Revoke(uint256 indexed account, uint256 indexed id, uint256 indexed amount, uint256 decision);

    // emitted when someone applies to have a loan rated
    event Apply(address indexed token);

    /**
     * @dev vote on a loan id
     * (decision == true)  -> YES
     * (decision == false) -> NO
     */
    function vote(uint256 id, uint256 amount, bool decision) virtual external;

    /**
     * @dev remove vote on a loan id
     * (decision == true)  -> YES
     * (decision == false) -> NO
     */
    function revoke(uint256 id, uint256 amount, bool decision) virtual external;

    /**
     * @dev get loan details from token and store in struct
     * start voting window
     */
    function register(ILoanToken token) virtual external;
}