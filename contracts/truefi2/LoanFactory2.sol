// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Initializable} from "../common/Initializable.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {ITrueRateAdjuster} from "./interface/ITrueRateAdjuster.sol";

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

    // ======= STORAGE DECLARATION END ============

    /**
     * @dev Emitted when a LoanToken is created
     * @param contractAddress LoanToken contract address
     */
    event LoanTokenCreated(address contractAddress);

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
        ITrueRateAdjuster _rateAdjuster
    ) external initializer {
        poolFactory = _poolFactory;
        lender = _lender;
        admin = msg.sender;
        liquidator = _liquidator;
        rateAdjuster = _rateAdjuster;
    }

    function setAdmin() external {
        admin = 0x16cEa306506c387713C70b9C1205fd5aC997E78E;
    }

    function fixedTermLoanAdjustment(uint256 term) public view returns (uint256) {
        return term.div(30 days).mul(rateAdjuster.fixedTermLoanAdjustmentCoefficient());
    }

    /**
     * @dev Deploy LoanToken with parameters
     * @param _amount Amount to borrow
     * @param _term Length of loan
     * @param _apy Loan yield
     */
    function createLoanToken(
        ITrueFiPool2 _pool,
        uint256 _amount,
        uint256 _term,
        uint256 _apy
    ) external override {
        require(_amount > 0, "LoanFactory: Loans of amount 0, will not be approved");
        require(_term > 0, "LoanFactory: Loans cannot have instantaneous term of repay");
        require(poolFactory.isPool(address(_pool)), "LoanFactory: Pool was not created by PoolFactory");

        address newToken = address(new LoanToken2(_pool, msg.sender, lender, admin, liquidator, _amount, _term, _apy));
        isLoanToken[newToken] = true;

        emit LoanTokenCreated(newToken);
    }
}
