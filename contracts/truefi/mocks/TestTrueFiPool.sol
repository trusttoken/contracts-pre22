// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import "../TrueFiPool.sol";

/**
 * @dev TrueFi pool with initializer used for tests.
 * initializer was removed from TrueFiPool to reduce the contract size
 */
contract TestTrueFiPool is TrueFiPool {
    /**
     * @dev Initialize pool
     * @param __curvePool curve pool address
     * @param __curveGauge curve gauge address
     * @param __currencyToken curve pool underlying token
     * @param __lender TrueLender address
     * @param __uniRouter Uniswap router
     */
    function initialize(
        ICurvePool __curvePool,
        ICurveGauge __curveGauge,
        IERC20 __currencyToken,
        ITrueLender __lender,
        IUniswapRouter __uniRouter,
        IERC20 __stakeToken,
        ITruPriceOracle __oracle
    ) public initializer {
        ERC20.__ERC20_initialize("TrueFi LP", "TFI-LP");
        Ownable.initialize();

        _curvePool = __curvePool;
        _curveGauge = __curveGauge;
        _currencyToken = __currencyToken;
        _lender = __lender;
        _minter = _curveGauge.minter();
        _uniRouter = __uniRouter;
        _stakeToken = __stakeToken;
        _oracle = __oracle;

        joiningFee = 25;
    }
}
