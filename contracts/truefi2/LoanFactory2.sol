// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Initializable} from "../common/Initializable.sol";
import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ILoanFactory2} from "./interface/ILoanFactory2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";

import {LoanToken2, IERC20} from "./LoanToken2.sol";

/**
 * @title LoanFactory2
 * @notice Deploy LoanTokens for pools created by PoolFactory, with this Contract
 * @dev LoanTokens are deployed through a factory to ensure that all
 * LoanTokens adhere to the same contract code, rather than using an interface.
 */
contract LoanFactory2 is ILoanFactory2, Initializable {
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
        address _liquidator
    ) external initializer {
        poolFactory = _poolFactory;
        lender = _lender;
        liquidator = _liquidator;
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

        address newToken = address(new LoanToken2(_pool, msg.sender, lender, liquidator, _amount, _term, _apy));
        isLoanToken[newToken] = true;

        emit LoanTokenCreated(newToken);
    }
}
