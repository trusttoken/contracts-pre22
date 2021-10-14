// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {IFixedTermLoanAgency} from "./interface/IFixedTermLoanAgency.sol";
import {Initializable} from "../common/Initializable.sol";
import {ILoanToken2Deprecated} from "./deprecated/ILoanToken2Deprecated.sol";
import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {IDebtToken} from "./interface/IDebtToken.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";
import {ILineOfCreditAgency} from "./interface/ILineOfCreditAgency.sol";

import {LoanToken2, IERC20} from "./LoanToken2.sol";
import {DebtToken} from "./DebtToken.sol";

/**
 * @title LoanFactory2
 * @notice Deploy LoanTokens with this Contract
 * @dev LoanTokens are deployed through a factory to ensure that all
 * LoanTokens adhere to the same contract code, rather than using an interface.
 */
contract LoanFactory2 is ILoanFactory2, Initializable {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // @dev Track legacy LoanTokens
    mapping(ILoanToken2Deprecated => bool) public override isLegacyLoanToken;

    address private DEPRECATED__poolFactory;
    address private DEPRECATED__lender;
    address public liquidator;

    address public admin;

    address private DEPRECATED__creditModel;
    ITrueFiCreditOracle public creditOracle;
    IBorrowingMutex public borrowingMutex;
    ILoanToken2 public loanTokenImplementation;
    ILineOfCreditAgency public creditAgency;
    IDebtToken public debtTokenImplementation;

    // @dev Track valid debtTokens
    mapping(IDebtToken => bool) public override isDebtToken;

    IFixedTermLoanAgency public ftlAgency;

    mapping(ILoanToken2 => bool) public override isLoanToken;

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a LoanToken is created
     * @param loanToken LoanToken contract address
     */
    event LoanTokenCreated(ILoanToken2 loanToken);

    /**
     * @dev Emitted when a DebtToken is created
     * @param debtToken DebtToken contract address
     */
    event DebtTokenCreated(IDebtToken debtToken);

    event CreditOracleChanged(ITrueFiCreditOracle creditOracle);

    event BorrowingMutexChanged(IBorrowingMutex borrowingMutex);

    event LoanTokenImplementationChanged(ILoanToken2 loanTokenImplementation);

    event CreditAgencyChanged(ILineOfCreditAgency creditAgency);

    event DebtTokenImplementationChanged(IDebtToken debtTokenImplementation);

    event FixedTermLoanAgencyChanged(IFixedTermLoanAgency ftlAgency);

    /**
     * @dev Initialize this contract and set currency token
     * @param _ftlAgency FixedTermLoanAgency address
     * @param _liquidator Liquidator address
     */
    function initialize(
        IFixedTermLoanAgency _ftlAgency,
        address _liquidator,
        ITrueFiCreditOracle _creditOracle,
        IBorrowingMutex _borrowingMutex,
        ILineOfCreditAgency _creditAgency
    ) external initializer {
        ftlAgency = _ftlAgency;
        admin = msg.sender;
        liquidator = _liquidator;
        creditOracle = _creditOracle;
        borrowingMutex = _borrowingMutex;
        creditAgency = _creditAgency;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "LoanFactory: Caller is not the admin");
        _;
    }

    modifier onlyFTLA() {
        require(msg.sender == address(ftlAgency), "LoanFactory: Caller is not the fixed term loan agency");
        _;
    }

    modifier onlyLineOfCreditAgencyOrLoanToken() {
        require(
            msg.sender == address(creditAgency) || isLoanToken[ILoanToken2(msg.sender)],
            "LoanFactory: Caller is neither credit agency nor loan"
        );
        _;
    }

    /**
     * @dev This function must be called once to set admin to the hardcoded address
     * The address is hardcoded because there was no owner of the contract previously
     */
    function setAdmin() external {
        admin = 0x16cEa306506c387713C70b9C1205fd5aC997E78E;
    }

    function createLoanToken(
        ITrueFiPool2 _pool,
        address _borrower,
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external override onlyFTLA returns (ILoanToken2) {
        address ltImplementationAddress = address(loanTokenImplementation);
        require(ltImplementationAddress != address(0), "LoanFactory: Loan token implementation should be set");

        LoanToken2 newToken = LoanToken2(Clones.clone(ltImplementationAddress));
        newToken.initialize(_pool, borrowingMutex, _borrower, ftlAgency, admin, this, creditOracle, _amount, _term, _apy);
        isLoanToken[newToken] = true;

        emit LoanTokenCreated(newToken);
        return newToken;
    }

    function createDebtToken(
        ITrueFiPool2 _pool,
        address _borrower,
        uint256 _debt
    ) external override onlyLineOfCreditAgencyOrLoanToken returns (IDebtToken) {
        address dtImplementationAddress = address(debtTokenImplementation);
        require(dtImplementationAddress != address(0), "LoanFactory: Debt token implementation should be set");

        DebtToken newToken = DebtToken(Clones.clone(dtImplementationAddress));
        newToken.initialize(_pool, msg.sender, _borrower, liquidator, _debt);
        isDebtToken[newToken] = true;

        emit DebtTokenCreated(newToken);
        return newToken;
    }

    function setCreditOracle(ITrueFiCreditOracle _creditOracle) external onlyAdmin {
        require(address(_creditOracle) != address(0), "LoanFactory: Cannot set credit oracle to zero address");
        creditOracle = _creditOracle;
        emit CreditOracleChanged(_creditOracle);
    }

    function setBorrowingMutex(IBorrowingMutex _mutex) external onlyAdmin {
        require(address(_mutex) != address(0), "LoanFactory: Cannot set borrowing mutex to zero address");
        borrowingMutex = _mutex;
        emit BorrowingMutexChanged(_mutex);
    }

    function setLoanTokenImplementation(ILoanToken2 _implementation) external onlyAdmin {
        require(address(_implementation) != address(0), "LoanFactory: Cannot set loan token implementation to zero address");
        loanTokenImplementation = _implementation;
        emit LoanTokenImplementationChanged(_implementation);
    }

    function setCreditAgency(ILineOfCreditAgency _creditAgency) external onlyAdmin {
        require(address(_creditAgency) != address(0), "LoanFactory: Cannot set credit agency to zero address");
        creditAgency = _creditAgency;
        emit CreditAgencyChanged(_creditAgency);
    }

    function setDebtTokenImplementation(IDebtToken _implementation) external onlyAdmin {
        require(address(_implementation) != address(0), "LoanFactory: Cannot set debt token implementation to zero address");
        debtTokenImplementation = _implementation;
        emit DebtTokenImplementationChanged(_implementation);
    }

    function setFixedTermLoanAgency(IFixedTermLoanAgency _ftlAgency) external onlyAdmin {
        require(address(_ftlAgency) != address(0), "LoanFactory: Cannot set fixed term loan agency to zero address");
        ftlAgency = _ftlAgency;
        emit FixedTermLoanAgencyChanged(_ftlAgency);
    }
}
