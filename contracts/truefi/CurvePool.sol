// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ITruePool} from "./interface/ITruePool.sol";
import {ICurvePool, ICurveGauge} from "./interface/ICurvePool.sol";
import {ITrueLender} from "./interface/ITrueLender.sol";
import {ERC20} from "./upgradeability/UpgradeableERC20.sol";
import {Ownable} from "./upgradeability/UpgradeableOwnable.sol";

contract CurvePool is ITruePool, ERC20, ReentrancyGuard, Ownable {
    using SafeMath for uint256;

    ICurvePool public _curvePool;
    ICurveGauge public _curveGauge;
    IERC20 public _currencyToken;
    ITrueLender public _lender;

    uint8 constant N_TOKENS = 4;
    uint8 constant TUSD_INDEX = 3;

    function initialize(
        ICurvePool __curvePool,
        ICurveGauge __curveGauge,
        IERC20 __currencyToken,
        ITrueLender __lender
    ) public initializer {
        ERC20.__ERC20_initialize("CurveTUSDPool", "crvTUSD");
        Ownable.initialize();

        _curvePool = __curvePool;
        _curveGauge = __curveGauge;
        _currencyToken = __currencyToken;
        _lender = __lender;

        _currencyToken.approve(address(_curvePool), uint256(-1));
        _curvePool.token().approve(address(_curvePool), uint256(-1));
    }

    function currencyToken() public override view returns (IERC20) {
        return _currencyToken;
    }

    function totalLiquidityTokenBalance() public view returns (uint256) {
        return _curvePool.token().balanceOf(address(this)).add(_curveGauge.balanceOf(address(this)));
    }

    function poolValue() public view returns (uint256) {
        return
            _currencyToken.balanceOf(address(this)).add(_lender.value()).add(
                totalLiquidityTokenBalance().mul(_curvePool.curve().get_virtual_price()).div(1 ether)
            );
    }

    function ensureEnoughTokensAreAvailable(uint256 neededAmount) internal {
        uint256 currentlyAvailableAmount = _curvePool.token().balanceOf(address(this));
        if (currentlyAvailableAmount < neededAmount) {
            _curveGauge.withdraw(neededAmount.sub(currentlyAvailableAmount));
        }
    }

    function join(uint256 amount) external override {
        uint256 amountToMint = amount;
        if (totalSupply() > 0) {
            amountToMint = totalSupply().mul(amount).div(poolValue());
        }
        _mint(msg.sender, amountToMint);

        require(_currencyToken.transferFrom(msg.sender, address(this), amount));
    }

    function exit(uint256 amount) external override nonReentrant {
        require(amount <= balanceOf(msg.sender), "CurvePool: insufficient funds");

        uint256 _totalSupply = totalSupply();

        uint256 currencyAmountToTransfer = amount.mul(_currencyToken.balanceOf(address(this))).div(_totalSupply);
        uint256 curveLiquidityAmountToTransfer = amount.mul(totalLiquidityTokenBalance()).div(_totalSupply);

        _burn(msg.sender, amount);

        _lender.distribute(msg.sender, amount, _totalSupply);
        if (currencyAmountToTransfer > 0) {
            require(_currencyToken.transfer(msg.sender, currencyAmountToTransfer));
        }
        if (curveLiquidityAmountToTransfer > 0) {
            ensureEnoughTokensAreAvailable(curveLiquidityAmountToTransfer);
            require(_curvePool.token().transfer(msg.sender, curveLiquidityAmountToTransfer));
        }
    }

    function flush(uint256 currencyAmount, uint256 minMintAmount) external onlyOwner {
        require(currencyAmount <= _currencyToken.balanceOf(address(this)), "CurvePool: Insufficient currency balance");

        uint256[N_TOKENS] memory amounts = [0, 0, 0, currencyAmount];
        _curvePool.add_liquidity(amounts, minMintAmount);
        _curveGauge.deposit(_curvePool.token().balanceOf(address(this)));
    }

    function pull(uint256 crvAmount, uint256 minCurrencyAmount) external onlyOwner {
        require(crvAmount <= totalLiquidityTokenBalance(), "CurvePool: Insufficient Curve liquidity balance");

        ensureEnoughTokensAreAvailable(crvAmount);
        _curvePool.remove_liquidity_one_coin(crvAmount, TUSD_INDEX, minCurrencyAmount, false);
    }

    function borrow(uint256 expectedAmount) external override nonReentrant {
        require(msg.sender == address(_lender), "CurvePool: Only lender can borrow");

        if (expectedAmount > _currencyToken.balanceOf(address(this))) {
            uint256 amountToWithdraw = expectedAmount.sub(_currencyToken.balanceOf(address(this)));
            uint256 roughCurveTokenAmount = calcTokenAmount(amountToWithdraw).mul(1005).div(1000);
            require(
                roughCurveTokenAmount <= totalLiquidityTokenBalance(),
                "CurvePool: Not enough Curve liquidity tokens in pool to cover borrow"
            );
            ensureEnoughTokensAreAvailable(roughCurveTokenAmount);
            _curvePool.remove_liquidity_one_coin(roughCurveTokenAmount, TUSD_INDEX, 0, false);
            require(expectedAmount <= _currencyToken.balanceOf(address(this)), "CurvePool: Not enough funds in pool to cover borrow");
        }

        require(_currencyToken.transfer(msg.sender, expectedAmount));
    }

    function repay(uint256 currencyAmount) external override {
        require(_currencyToken.transferFrom(msg.sender, address(this), currencyAmount));
    }

    /**
     * @notice Expected amount of minted Curve.fi yDAI/yUSDC/yUSDT/yTUSD tokens.
     * Can be used to control slippage
     */
    function calcTokenAmount(uint256 currencyAmount) public view returns (uint256) {
        uint256 yTokenAmount = currencyAmount.mul(1e18).div(_curvePool.coins(TUSD_INDEX).getPricePerFullShare());
        uint256[N_TOKENS] memory yAmounts = [0, 0, 0, yTokenAmount];
        return _curvePool.curve().calc_token_amount(yAmounts, true);
    }

    function calcWithdrawOneCoin(uint256 crvAmount) public view returns (uint256) {
        return _curvePool.calc_withdraw_one_coin(crvAmount, TUSD_INDEX);
    }
}
