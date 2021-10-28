// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "../common/UpgradeableERC20.sol";
import {IDebtToken} from "./interface/IDebtToken.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract DebtToken is IDebtToken, ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    address public override borrower;
    uint256 public override debt;

    address public liquidator;
    ITrueFiPool2 public override pool;

    uint256 public redeemed;

    bool public override isLiquidated;

    /**
     * @dev Emitted when a DebtToken is repaid by the borrower in underlying tokens
     * @param repayer Sender of tokens
     * @param repaidAmount Amount of token repaid
     */
    event Repaid(address repayer, uint256 repaidAmount);

    /**
     * @dev Emitted when a DebtToken is redeemed for underlying tokens
     * @param receiver Receiver of tokens
     * @param burnedAmount Amount of DebtTokens burned
     * @param redeemedAmount Amount of token received
     */
    event Redeemed(address receiver, uint256 burnedAmount, uint256 redeemedAmount);

    /**
     * @dev Emitted when debt gets liquidated
     */
    event Liquidated();

    function initialize(
        ITrueFiPool2 _pool,
        address _holder,
        address _borrower,
        address _liquidator,
        uint256 _debt
    ) external initializer {
        ERC20.__ERC20_initialize("TrueFi Debt Token", "DEBT");

        pool = _pool;
        borrower = _borrower;
        liquidator = _liquidator;
        debt = _debt;
        _mint(_holder, _debt);
    }

    /**
     * @dev Function for borrower to repay the debt
     * Borrower can repay at any time
     * @param _sender account sending token to repay
     * @param _amount amount of token to repay
     */
    function repay(address _sender, uint256 _amount) external {
        // _repay(_sender, _amount);
    }

    /**
     * @dev Function for borrower to repay all of the remaining debt balance
     * Borrower should use this to ensure full repayment
     * @param _sender account sending token to repay
     */
    function repayInFull(address _sender) external {
        // _repay(_sender, unpaidDebt());
    }

    /**
     * @dev Internal function for debt repayment
     * @param _sender account sending token to repay
     * @param _amount amount of token to repay
     */
    function _repay(address _sender, uint256 _amount) private {
        // require(_amount <= unpaidDebt(), "LoanToken2: Repay amount more than unpaid debt");

        // token.safeTransferFrom(_sender, address(this), _amount);
        // emit Repaid(_sender, _amount);
    }

    /**
     * @dev Redeem DebtToken balances for underlying token
     * @param _amount amount to redeem
     */
    function redeem(uint256 _amount) external override {
        require(_amount <= _balance(), "DebtToken: Insufficient repaid amount");

        uint256 amountToReturn = _amount;
        if (_amount == totalSupply()) {
            amountToReturn = _balance();
        }
        redeemed = redeemed.add(amountToReturn);
        _burn(msg.sender, _amount);
        token().safeTransfer(msg.sender, amountToReturn);

        emit Redeemed(msg.sender, _amount, amountToReturn);
    }

    /**
     * @dev Liquidate the debt if it has defaulted
     */
    function liquidate() external override {
        require(!isLiquidated, "DebtToken: Debt must not be liquidated");
        require(msg.sender == liquidator, "DebtToken: Caller is not the liquidator");

        isLiquidated = true;

        emit Liquidated();
    }

    /**
     * @dev Check how much was already repaid
     * Funds stored on the contract's address plus funds already redeemed by lenders
     * @return Uint256 representing what value was already repaid
     */
    function repaid() public override view returns (uint256) {
        return _balance().add(redeemed);
    }

    /**
     * @dev Public currency token balance function
     * @return token balance of this contract
     */
    function balance() external override view returns (uint256) {
        return _balance();
    }

    function token() public override view returns (ERC20) {
        return pool.token();
    }

    function decimals() public override view returns (uint8) {
        return token().decimals();
    }

    function version() external override pure returns (uint8) {
        return 1;
    }

    /**
     * @dev Get currency token balance for this contract
     * @return token balance of this contract
     */
    function _balance() internal view returns (uint256) {
        return token().balanceOf(address(this));
    }
}
