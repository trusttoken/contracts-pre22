// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TruePool, IERC20} from "./TruePool.sol";
import {ICurvePool} from "./interface/ICurvePool.sol";

contract CurvePool is TruePool, ReentrancyGuard {
    using SafeMath for uint256;

    ICurvePool public curvePool;
    address public lender;

    /**
     * This is a difference between this token totalSupply and balance of cTokens
     * Should be not above zero to make full complete exit possible
     */
    int256 public totalBorrowCoverage = 0;

    uint8 constant N_TOKENS = 4;
    uint8 constant TUSD_INDEX = 3;

    constructor(
        ICurvePool _curve,
        IERC20 _currencyToken,
        address _lender
    ) public TruePool(_currencyToken, "CurveTUSDPool", "CurTUSD") {
        curvePool = _curve;
        lender = _lender;
        currencyToken().approve(address(curvePool), uint256(-1));
        curvePool.token().approve(address(curvePool), uint256(-1));
    }

    function join(uint256 amount) external override nonReentrant {
        require(currencyToken().transferFrom(msg.sender, address(this), amount));

        uint256[N_TOKENS] memory amounts = [0, 0, 0, amount];

        uint256 balanceBefore = curvePool.token().balanceOf(address(this));
        curvePool.add_liquidity(amounts, 0);
        uint256 balanceAfter = curvePool.token().balanceOf(address(this));
        _mint(msg.sender, balanceAfter.sub(balanceBefore));
    }

    function exit(uint256 amount) external override nonReentrant {
        require(amount <= balanceOf(msg.sender), "CurvePool: Cannot withdraw amount bigger than available balance");
        require(amount <= curvePool.token().balanceOf(address(this)), "CurvePool: Not enough cTokens in pool");

        uint256 balanceBefore = currencyToken().balanceOf(address(this));
        curvePool.remove_liquidity_one_coin(amount, TUSD_INDEX, 0, false);
        uint256 balanceAfter = currencyToken().balanceOf(address(this));
        require(currencyToken().transfer(msg.sender, balanceAfter.sub(balanceBefore)));
        _burn(msg.sender, amount);
    }

    function borrow(uint256 expectedAmount) external override nonReentrant {
        require(msg.sender == lender, "CurvePool: Only lender can borrow");

        uint256 roughCurveTokenAmount = value(expectedAmount).mul(1005).div(1000);
        require(
            roughCurveTokenAmount <= curvePool.token().balanceOf(address(this)),
            "CurvePool: Not enough cTokens in pool to cover borrow"
        );

        uint256 balanceBefore = currencyToken().balanceOf(address(this));
        curvePool.remove_liquidity_one_coin(roughCurveTokenAmount, TUSD_INDEX, 0, false);
        uint256 balanceAfter = currencyToken().balanceOf(address(this));

        require(balanceAfter.sub(balanceBefore) >= expectedAmount, "CurvePool: Not enough tokens withdrawn");
        require(currencyToken().transfer(msg.sender, expectedAmount));
    }

    function repay(uint256 amount) external override nonReentrant {
        require(currencyToken().transferFrom(msg.sender, address(this), amount));

        uint256 amountToDeposit = currencyToken().balanceOf(address(this));
        uint256[N_TOKENS] memory amounts = [0, 0, 0, amountToDeposit];

        curvePool.add_liquidity(amounts, 0);
    }

    function value(uint256 currencyAmount) public override view returns (uint256) {
        uint256 yTokenAmount = currencyAmount.mul(1e18).div(curvePool.coins(TUSD_INDEX).getPricePerFullShare());
        uint256[N_TOKENS] memory yAmounts = [0, 0, 0, yTokenAmount];
        return curvePool.curve().calc_token_amount(yAmounts, false);
    }
}
