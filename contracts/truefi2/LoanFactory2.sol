// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {Initializable} from "../common/Initializable.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITrueRateAdjuster} from "./interface/ITrueRateAdjuster.sol";
import {ITrueFiCreditOracle} from "./interface/ITrueFiCreditOracle.sol";
import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";

import {LoanToken2, IERC20} from "./LoanToken2.sol";

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

    IPoolFactory public poolFactory;
    address public lender;
    address public liquidator;

    address public admin;

    ITrueRateAdjuster public rateAdjuster;
    ITrueFiCreditOracle public creditOracle;
    IBorrowingMutex public borrowingMutex;
    address public loanTokenImplementation;
    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a LoanToken is created
     * @param contractAddress LoanToken contract address
     */
    event LoanTokenCreated(address contractAddress);

    event CreditOracleChanged(ITrueFiCreditOracle creditOracle);

    event RateAdjusterChanged(ITrueRateAdjuster rateAdjuster);

    event BorrowingMutexChanged(IBorrowingMutex borrowingMutex);

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
        IBorrowingMutex _borrowingMutex
    ) external initializer {
        poolFactory = _poolFactory;
        lender = _lender;
        admin = msg.sender;
        liquidator = _liquidator;
        rateAdjuster = _rateAdjuster;
        creditOracle = _creditOracle;
        borrowingMutex = _borrowingMutex;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "LoanFactory: Caller is not the admin");
        _;
    }

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

    function setLoanTokenImplementation(address newImplementation) external onlyAdmin {
        loanTokenImplementation = newImplementation;
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
        require(poolFactory.isPool(address(_pool)), "LoanFactory: Pool was not created by PoolFactory");
        require(loanTokenImplementation != address(0), "LoanFactory: Loan token implementation should be set");

        uint256 apy = rate(_pool, msg.sender, _amount, _term);

        require(apy <= _maxApy, "LoanFactory: Calculated apy is higher than max apy");

        address newToken = Clones.clone(loanTokenImplementation);
        LoanToken2(newToken).initialize(_pool, borrowingMutex, msg.sender, lender, admin, liquidator, _amount, _term, apy);
        isLoanToken[newToken] = true;

        emit LoanTokenCreated(newToken);
    }

    function setCreditOracle(ITrueFiCreditOracle _creditOracle) external onlyAdmin {
        creditOracle = _creditOracle;
        emit CreditOracleChanged(_creditOracle);
    }

    function setRateAdjuster(ITrueRateAdjuster _rateAdjuster) external onlyAdmin {
        rateAdjuster = _rateAdjuster;
        emit RateAdjusterChanged(_rateAdjuster);
    }

    function setBorrowingMutex(IBorrowingMutex _mutex) external onlyAdmin {
        borrowingMutex = _mutex;
        emit BorrowingMutexChanged(_mutex);
    }
}
