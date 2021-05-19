// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {UpgradeableClaimable} from "../../common/UpgradeableClaimable.sol";

import {ITrueStrategy} from "../interface/ITrueStrategy.sol";
import {ICurveGauge, ICurveMinter, ICurvePool, IERC20} from "../../truefi/interface/ICurve.sol";
import {ICrvPriceOracle} from "../../truefi/interface/ICrvPriceOracle.sol";
import {IUniswapRouter} from "../../truefi/interface/IUniswapRouter.sol";
import {ITrueFiPool2} from "../interface/ITrueFiPool2.sol";
import {I1Inch3} from "../interface/I1Inch3.sol";
import {OneInchExchange} from "../libraries/OneInchExchange.sol";
import {IERC20WithDecimals} from "../interface/IERC20WithDecimals.sol";

/**
 * @dev TrueFi pool strategy that allows depositing stablecoins into Curve Yearn pool (0x45F783CCE6B7FF23B2ab2D70e416cdb7D6055f51)
 * Supports DAI, USDC, USDT and TUSD
 * Curve LP tokens are being deposited into Curve Gauge and CRV rewards can be sold on 1Inch exchange and transferred to the pool
 */
contract CurveYearnStrategy is UpgradeableClaimable, ITrueStrategy {
    using SafeMath for uint256;
    using SafeERC20 for IERC20WithDecimals;
    using OneInchExchange for I1Inch3;

    // Number of tokens in Curve yPool
    uint8 public constant N_TOKENS = 4;
    // Max slippage during the swap
    uint256 public constant MAX_PRICE_SLIPPAGE = 200; // 2%

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // Index of token in Curve pool
    // 0 - DAI
    // 1 - USDC
    // 2 - USDT
    // 3 - TUSD
    uint8 public tokenIndex;

    ICurvePool public curvePool;
    ICurveGauge public curveGauge;
    ICurveMinter public minter;
    I1Inch3 public _1Inch;

    IERC20WithDecimals public token;
    address public pool;

    // CRV price oracle
    ICrvPriceOracle public crvOracle;

    // ======= STORAGE DECLARATION END ===========

    modifier onlyPool() {
        require(msg.sender == pool, "CurveYearnStrategy: Can only be called by pool");
        _;
    }

    function initialize(
        ITrueFiPool2 _pool,
        ICurvePool _curvePool,
        ICurveGauge _curveGauge,
        ICurveMinter _minter,
        I1Inch3 _1inchExchange,
        ICrvPriceOracle _crvOracle,
        uint8 _tokenIndex
    ) external initializer {
        UpgradeableClaimable.initialize(msg.sender);

        token = IERC20WithDecimals(address(_pool.token()));
        pool = address(_pool);

        curvePool = _curvePool;
        curveGauge = _curveGauge;
        minter = _minter;
        _1Inch = _1inchExchange;
        crvOracle = _crvOracle;
        tokenIndex = _tokenIndex;
    }

    /**
     * @dev Transfer `amount` of `token` from pool and add it as
     * liquidity to the Curve yEarn Pool
     * Curve LP tokens are deposited into Curve Gauge
     * @param amount amount of token to add to curve
     */
    function deposit(uint256 amount) external override onlyPool {
        token.safeTransferFrom(pool, address(this), amount);

        uint256 totalAmount = token.balanceOf(address(this));
        uint256[N_TOKENS] memory amounts = [uint256(0), 0, 0, 0];
        amounts[tokenIndex] = totalAmount;

        token.approve(address(curvePool), totalAmount);
        uint256 conservativeMinAmount = calcTokenAmount(totalAmount).mul(999).div(1000);
        curvePool.add_liquidity(amounts, conservativeMinAmount);

        // stake yCurve tokens in gauge
        uint256 yBalance = curvePool.token().balanceOf(address(this));
        curvePool.token().approve(address(curveGauge), yBalance);
        curveGauge.deposit(yBalance);
    }

    /**
     * @dev pull at least `minAmount` of tokens from strategy
     * Remove token liquidity from curve and transfer to pool
     * @param minAmount Minimum amount of tokens to remove from strategy
     */
    function withdraw(uint256 minAmount) external override onlyPool {
        // get rough estimate of how much yCRV we should sell
        uint256 roughCurveTokenAmount = calcTokenAmount(minAmount);
        uint256 yBalance = yTokenBalance();
        require(roughCurveTokenAmount <= yBalance, "CurveYearnStrategy: Not enough Curve liquidity tokens in pool to cover borrow");
        // Try to withdraw a bit more to be safe, but not above the total balance
        uint256 conservativeCurveTokenAmount = min(yBalance, roughCurveTokenAmount.mul(1005).div(1000));

        // pull tokens from gauge
        withdrawFromGaugeIfNecessary(conservativeCurveTokenAmount);
        // remove TUSD from curve
        curvePool.token().approve(address(curvePool), conservativeCurveTokenAmount);
        curvePool.remove_liquidity_one_coin(conservativeCurveTokenAmount, tokenIndex, minAmount, false);
        transferAllToPool();
    }

    /**
     *@dev withdraw everything from strategy
     * Use with caution because Curve slippage is not contolled
     */
    function withdrawAll() external override onlyPool {
        curveGauge.withdraw(curveGauge.balanceOf(address(this)));
        uint256 yBalance = yTokenBalance();
        curvePool.token().approve(address(curvePool), yBalance);
        curvePool.remove_liquidity_one_coin(yBalance, tokenIndex, 0, false);
        transferAllToPool();
    }

    /**
     * @dev Total pool value in USD
     * @notice Balance of CRV is not included into value of strategy,
     * because it cannot be converted to pool tokens automatically
     * @return Value of pool in USD
     */
    function value() external override view returns (uint256) {
        return yTokenValue();
    }

    /**
     * @dev Price of  in USD
     * @return Oracle price of TRU in USD
     */
    function yTokenValue() public view returns (uint256) {
        return normalizeDecimals(yTokenBalance().mul(curvePool.curve().get_virtual_price()).div(1 ether));
    }

    /**
     * @dev Get total balance of curve.fi pool tokens
     * @return Balance of y pool tokens in this contract
     */
    function yTokenBalance() public view returns (uint256) {
        return curvePool.token().balanceOf(address(this)).add(curveGauge.balanceOf(address(this)));
    }

    /**
     * @dev Price of CRV in USD
     * @return Oracle price of TRU in USD
     */
    function crvValue() public view returns (uint256) {
        uint256 balance = crvBalance();
        if (balance == 0 || address(crvOracle) == address(0)) {
            return 0;
        }
        return normalizeDecimals(conservativePriceEstimation(crvOracle.crvToUsd(balance)));
    }

    /**
     * @dev Get total balance of CRV tokens
     * @return Balance of stake tokens in this contract
     */
    function crvBalance() public view returns (uint256) {
        return minter.token().balanceOf(address(this));
    }

    /**
     * @dev Collect CRV tokens minted by staking at gauge
     */
    function collectCrv() external {
        minter.mint(address(curveGauge));
    }

    /**
     * @dev Swap collected CRV on 1inch and transfer gains to the pool
     * Receiver of the tokens should be the pool
     * Revert if resulting exchange price is much smaller than the oracle price
     * @param data Data that is forwarded into the 1inch exchange contract. Can be acquired from 1Inch API https://api.1inch.exchange/v3.0/1/swap
     * [See more](https://docs.1inch.exchange/api/quote-swap#swap)
     */
    function sellCrv(bytes calldata data) external {
        uint256 balanceBefore = token.balanceOf(pool);
        I1Inch3.SwapDescription memory swap = _1Inch.exchange(data);
        uint256 balanceDiff = token.balanceOf(pool).sub(balanceBefore);

        uint256 expectedGain = normalizeDecimals(crvOracle.crvToUsd(swap.amount));

        require(swap.srcToken == address(minter.token()), "CurveYearnStrategy: Source token is not CRV");
        require(swap.dstToken == address(token), "CurveYearnStrategy: Destination token is not TUSD");
        require(swap.dstReceiver == pool, "CurveYearnStrategy: Receiver is not pool");

        require(balanceDiff >= conservativePriceEstimation(expectedGain), "CurveYearnStrategy: Not optimal exchange");
    }

    /**
     * @dev Expected amount of minted Curve.fi yDAI/yUSDC/yUSDT/yTUSD tokens.
     * @param currencyAmount amount to calculate for
     * @return expected amount minted given currency amount
     */
    function calcTokenAmount(uint256 currencyAmount) public view returns (uint256) {
        uint256 yTokenAmount = currencyAmount.mul(1e18).div(curvePool.coins(tokenIndex).getPricePerFullShare());
        uint256[N_TOKENS] memory yAmounts = [uint256(0), 0, 0, 0];
        yAmounts[tokenIndex] = yTokenAmount;
        return curvePool.curve().calc_token_amount(yAmounts, true);
    }

    /**
     * @dev ensure enough curve.fi pool tokens are available
     * Check if current available amount of TUSD is enough and
     * withdraw remainder from gauge
     * @param neededAmount amount required
     */
    function withdrawFromGaugeIfNecessary(uint256 neededAmount) internal {
        uint256 currentlyAvailableAmount = curvePool.token().balanceOf(address(this));
        if (currentlyAvailableAmount < neededAmount) {
            curveGauge.withdraw(neededAmount.sub(currentlyAvailableAmount));
        }
    }

    /**
     * @dev Internal function to transfer entire token balance to pool
     */
    function transferAllToPool() internal {
        token.safeTransfer(pool, token.balanceOf(address(this)));
    }

    /**
     * @dev Calculate price minus max percentage of slippage during exchange
     * This will lead to the pool value become a bit undervalued
     * compared to the oracle price but will ensure that the value doesn't drop
     * when token exchanges are performed.
     */
    function conservativePriceEstimation(uint256 price) internal pure returns (uint256) {
        return price.mul(uint256(10000).sub(MAX_PRICE_SLIPPAGE)).div(10000);
    }

    /**
     * @dev Helper function to calculate minimum of `a` and `b`
     * @param a First variable to check if minimum
     * @param b Second variable to check if minimum
     * @return Lowest value between a and b
     */
    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a > b ? b : a;
    }

    /**
     * @dev Helper function to convert between token precision
     * @param _value Value to normalize decimals for
     * @return Normalized value
     */
    function normalizeDecimals(uint256 _value) internal view returns (uint256) {
        return _value.mul(10**token.decimals()).div(10**18);
    }
}
