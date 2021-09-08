// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {Initializable} from "../common/Initializable.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ILoanToken2} from "./interface/ILoanToken2.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITrueRateAdjuster} from "./interface/ITrueRateAdjuster.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";
import {ITrueCreditAgency} from "./interface/ITrueCreditAgency.sol";

import {LoanToken2, IERC20} from "./LoanToken2.sol";
import {DebtToken} from "./DebtToken.sol";

/**
 * @title LoanFactory2
 * @notice Deploy LoanTokens for pools created by PoolFactory, with this Contract
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

    // @dev Track Valid LoanTokens
    mapping(address => bool) public override isLoanToken;

    // @dev Track valid debtTokens
    mapping(address => bool) public isDebtToken;

    IPoolFactory public poolFactory;
    address public lender;
    address public liquidator;

    address public admin;

    ITrueRateAdjuster public rateAdjuster;
    ITrueFiCreditOracle public creditOracle;
    IBorrowingMutex public borrowingMutex;
    ILoanToken2 public loanTokenImplementation;
    ITrueCreditAgency public creditAgency;
    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a LoanToken is created
     * @param contractAddress LoanToken contract address
     */
    event LoanTokenCreated(address contractAddress);

    /**
     * @dev Emitted when a DebtToken is created
     * @param contractAddress DebtToken contract address
     */
    event DebtTokenCreated(address contractAddress);

    event CreditOracleChanged(ITrueFiCreditOracle creditOracle);

    event RateAdjusterChanged(ITrueRateAdjuster rateAdjuster);

    event BorrowingMutexChanged(IBorrowingMutex borrowingMutex);

    event LoanTokenImplementationChanged(ILoanToken2 loanTokenImplementation);

    event CreditAgencyChanged(ITrueCreditAgency creditAgency);

    /**
     * @dev Initialize this contract and set currency token
     * @param _poolFactory PoolFactory address
     * @param _lender Lender address
     * @param _liquidator Liquidator address
     */
    function initialize(
        IPoolFactory _poolFactory,
        address _lender,
        address _liquidator,
        ITrueRateAdjuster _rateAdjuster,
        ITrueFiCreditOracle _creditOracle,
        IBorrowingMutex _borrowingMutex,
        ITrueCreditAgency _creditAgency
    ) external initializer {
        poolFactory = _poolFactory;
        lender = _lender;
        admin = msg.sender;
        liquidator = _liquidator;
        rateAdjuster = _rateAdjuster;
        creditOracle = _creditOracle;
        borrowingMutex = _borrowingMutex;
        creditAgency = _creditAgency;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "LoanFactory: Caller is not the admin");
        _;
    }

    modifier onlyTCA() {
        require(msg.sender == address(creditAgency), "LoanFactory: Caller is not the credit agency");
        _;
    }

    /**
     * @dev This function must be called once to set admin to the hardcoded address
     * The address is hardcoded because there was no owner of the contract previously
     */
    function setAdmin() external {
        admin = 0x16cEa306506c387713C70b9C1205fd5aC997E78E;
    }

    function rate(
        ITrueFiPool2 pool,
        address borrower,
        uint256 amount,
        uint256 _term
    ) internal view returns (uint256) {
        uint8 borrowerScore = creditOracle.score(borrower);
        uint256 fixedTermLoanAdjustment = rateAdjuster.fixedTermLoanAdjustment(_term);
        return rateAdjuster.rate(pool, borrowerScore, amount).add(fixedTermLoanAdjustment);
    }

    /**
     * @dev Deploy LoanToken with parameters
     * @param _amount Amount to borrow
     * @param _term Length of loan
     */
    function createLoanToken(
        ITrueFiPool2 _pool,
        uint256 _amount,
        uint256 _term,
        uint256 _maxApy
    ) external override {
        require(_amount > 0, "LoanFactory: Loans of amount 0, will not be approved");
        require(_term > 0, "LoanFactory: Loans cannot have instantaneous term of repay");
        require(poolFactory.isSupportedPool(_pool), "LoanFactory: Pool is not supported by PoolFactory");

        address ltImplementationAddress = address(loanTokenImplementation);
        require(ltImplementationAddress != address(0), "LoanFactory: Loan token implementation should be set");

        uint256 apy = rate(_pool, msg.sender, _amount, _term);

        require(apy <= _maxApy, "LoanFactory: Calculated apy is higher than max apy");

        address newToken = Clones.clone(ltImplementationAddress);
        LoanToken2(newToken).initialize(_pool, borrowingMutex, msg.sender, lender, admin, liquidator, _amount, _term, apy);
        isLoanToken[newToken] = true;

        emit LoanTokenCreated(newToken);
    }

    function createDebtToken(
        ITrueFiPool2 _pool,
        address _borrower,
        uint256 _debt
    ) external onlyTCA {
        address newToken = address(new DebtToken());
        isDebtToken[newToken] = true;

        DebtToken(newToken).initialize(_pool, lender, _borrower, liquidator, _debt);

        emit DebtTokenCreated(newToken);
    }

    function setCreditOracle(ITrueFiCreditOracle _creditOracle) external onlyAdmin {
        require(address(_creditOracle) != address(0), "LoanFactory: Cannot set credit oracle to address(0)");
        creditOracle = _creditOracle;
        emit CreditOracleChanged(_creditOracle);
    }

    function setRateAdjuster(ITrueRateAdjuster _rateAdjuster) external onlyAdmin {
        require(address(_rateAdjuster) != address(0), "LoanFactory: Cannot set rate adjuster to address(0)");
        rateAdjuster = _rateAdjuster;
        emit RateAdjusterChanged(_rateAdjuster);
    }

    function setBorrowingMutex(IBorrowingMutex _mutex) external onlyAdmin {
        require(address(_mutex) != address(0), "LoanFactory: Cannot set borrowing mutex to address(0)");
        borrowingMutex = _mutex;
        emit BorrowingMutexChanged(_mutex);
    }

    function setLoanTokenImplementation(ILoanToken2 _implementation) external onlyAdmin {
        require(address(_implementation) != address(0), "LoanFactory: Cannot set loan token implementation to address(0)");
        loanTokenImplementation = _implementation;
        emit LoanTokenImplementationChanged(_implementation);
    }

    function setCreditAgency(ITrueCreditAgency _creditAgency) external onlyAdmin {
        require(address(_creditAgency) != address(0), "LoanFactory: Cannot set credit agency to address(0)");
        creditAgency = _creditAgency;
        emit CreditAgencyChanged(_creditAgency);
    }
}
