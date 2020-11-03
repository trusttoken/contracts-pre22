// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ILoanFactory} from "./interface/ILoanFactory.sol";
import {Initializable} from "./upgradeability/Initializable.sol";

import {LoanToken, IERC20} from "./LoanToken.sol";

/**
 * @title LoanFactory
 * @notice Deploy LoanTokens with this Contract
 * @dev LoanTokens are deployed through a factory to ensure that all
 * LoanTokens adhere to the same contract code, rather than using an interface.
 */
contract LoanFactory is ILoanFactory, Initializable {
    IERC20 public currencyToken;

    // @dev Track Valid LoanTokens
    mapping(address => bool) public override isLoanToken;

    /**
     * @dev Emitted when a LoanToken is created
     * @param contractAddress LoanToken contract address
     */
    event LoanTokenCreated(address contractAddress);

    /**
     * @dev Initialize this contract and set currency token
     * @param _currencyToken Currency token to lend
     */
    function initialize(IERC20 _currencyToken) external initializer {
        currencyToken = _currencyToken;
    }

    /**
     * @dev Deploy LoanToken with parameters
     * @param _borrower Borrower address
     * @param _amount Amount to borrow
     * @param _term Length of loan
     * @param _apy Loan yield
     */
    function createLoanToken(
        address _borrower,
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external override {
        address newToken = address(new LoanToken(currencyToken, _borrower, _amount, _term, _apy));
        isLoanToken[newToken] = true;

        emit LoanTokenCreated(newToken);
    }
}
