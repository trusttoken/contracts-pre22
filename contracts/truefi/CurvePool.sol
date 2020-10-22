// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ITruePool} from "./interface/ITruePool.sol";
import {ICurvePool} from "./interface/ICurvePool.sol";

contract CurvePool is ITruePool, ERC20, ReentrancyGuard {
    using SafeMath for uint256;

    ICurvePool public curvePool;
    IERC20 public _currencyToken;
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
        IERC20 __currencyToken,
        address _lender
    ) public ERC20("CurveTUSDPool", "CurTUSD") {
        _currencyToken = __currencyToken;
        curvePool = _curve;
        lender = _lender;
        _currencyToken.approve(address(curvePool), uint256(-1));
        curvePool.token().approve(address(curvePool), uint256(-1));
    }

    function currencyToken() public override view returns (IERC20) {
        return _currencyToken;
    }

    function join(uint256 amount) external override nonReentrant {
        require(_currencyToken.transferFrom(msg.sender, address(this), amount));

        uint256[N_TOKENS] memory amounts = [0, 0, 0, amount];

        uint256 balanceBefore = curvePool.token().balanceOf(address(this));
        curvePool.add_liquidity(amounts, 0);
        uint256 balanceAfter = curvePool.token().balanceOf(address(this));
        _mint(msg.sender, balanceAfter.sub(balanceBefore));
    }

    function exit(uint256 amount) external override nonReentrant {
        require(amount <= balanceOf(msg.sender), "CurvePool: Cannot withdraw amount bigger than available balance");
        require(amount <= curvePool.token().balanceOf(address(this)), "CurvePool: Not enough cTokens in pool");

        uint256 balanceBefore = _currencyToken.balanceOf(address(this));
        curvePool.remove_liquidity_one_coin(amount, TUSD_INDEX, 0, false);
        uint256 balanceAfter = _currencyToken.balanceOf(address(this));
        require(_currencyToken.transfer(msg.sender, balanceAfter.sub(balanceBefore)));
        _burn(msg.sender, amount);
    }

    function borrow(uint256 expectedAmount) external override nonReentrant {
        require(msg.sender == lender, "CurvePool: Only lender can borrow");

        uint256 roughCurveTokenAmount = value(expectedAmount).mul(1005).div(1000);
        require(
            roughCurveTokenAmount <= curvePool.token().balanceOf(address(this)),
            "CurvePool: Not enough cTokens in pool to cover borrow"
        );

        uint256 balanceBefore = _currencyToken.balanceOf(address(this));
        curvePool.remove_liquidity_one_coin(roughCurveTokenAmount, TUSD_INDEX, 0, false);
        uint256 balanceAfter = _currencyToken.balanceOf(address(this));

        require(balanceAfter.sub(balanceBefore) >= expectedAmount, "CurvePool: Not enough tokens withdrawn");
        require(_currencyToken.transfer(msg.sender, expectedAmount));
    }

    function repay(uint256 amount) external override nonReentrant {
        require(_currencyToken.transferFrom(msg.sender, address(this), amount));

        uint256 amountToDeposit = _currencyToken.balanceOf(address(this));
        uint256[N_TOKENS] memory amounts = [0, 0, 0, amountToDeposit];

        curvePool.add_liquidity(amounts, 0);
    }

    function value(uint256 currencyAmount) public override view returns (uint256) {
        uint256 yTokenAmount = currencyAmount.mul(1e18).div(curvePool.coins(TUSD_INDEX).getPricePerFullShare());
        uint256[N_TOKENS] memory yAmounts = [0, 0, 0, yTokenAmount];
        return curvePool.curve().calc_token_amount(yAmounts, false);
    }
}
