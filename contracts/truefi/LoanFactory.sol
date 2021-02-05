// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Initializable} from "./common/Initializable.sol";
import {ILoanFactory} from "./interface/ILoanFactory.sol";

import {LoanToken, IERC20} from "./LoanToken.sol";

/**
 * @title LoanFactory
 * @notice Deploy LoanTokens with this Contract
 * @dev LoanTokens are deployed through a factory to ensure that all
 * LoanTokens adhere to the same contract code, rather than using an interface.
 */
contract LoanFactory is ILoanFactory, Initializable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IERC20 public currencyToken;

    // @dev Track Valid LoanTokens
    mapping(address => bool) public override isLoanToken;

    address public lender;
    address public liquidator;

    // ======= STORAGE DECLARATION END ============

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

    function setLender() external {
        lender = 0x16d02Dc67EB237C387023339356b25d1D54b0922;
    }

    function setLiquidator() external {
        liquidator = address(0); // to be changed for deployment
    }

    /**
     * @dev Deploy LoanToken with parameters
     * @param _amount Amount to borrow
     * @param _term Length of loan
     * @param _apy Loan yield
     */
    function createLoanToken(
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external override {
        require(_amount > 0, "LoanFactory: Loans of amount 0, will not be approved");
        require(_term > 0, "LoanFactory: Loans cannot have instantaneous term of repay");

        address newToken = address(new LoanToken(currencyToken, msg.sender, lender, liquidator, _amount, _term, _apy));
        isLoanToken[newToken] = true;

        emit LoanTokenCreated(newToken);
    }
}
