// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../TrueFiPool.sol";

/**
 * @dev TrueFi pool with initializer used for tests.
 * initializer was removed from TrueFiPool to reduce the contract size
 */
contract TestTrueFiPool is TrueFiPool {
    function initialize(
        ICurvePool __curvePool,
        ICurveGauge __curveGauge,
        IERC20 __currencyToken,
        ITrueLender __lender,
        IUniswapRouter __uniRouter,
        ITrueFiPoolOracle __truOracle,
        ICrvPriceOracle __crvOracle
    ) public initializer {
        ERC20.__ERC20_initialize("TrueFi LP", "TFI-LP");
        Ownable.initialize();
        _curvePool = __curvePool;
        _curveGauge = __curveGauge;
        token = __currencyToken;
        _lender = __lender;
        _minter = _curveGauge.minter();
        _uniRouter = __uniRouter;
        oracle = __truOracle;
        _crvOracle = __crvOracle;

        joiningFee = 25;
    }

    function superBorrow(uint256 amount, uint256 fee) external {
        super.borrow(amount, fee);
    }

    function borrow(uint256 amount, uint256 fee) public override nonReentrant onlyLender {
        // if there is not enough TUSD, withdraw from curve
        if (amount > currencyBalance()) {
            removeLiquidityFromCurve(amount.sub(currencyBalance()));
            require(amount <= currencyBalance(), "TrueFiPool: Not enough funds in pool to cover borrow");
        }

        mint(fee);
        require(token.transfer(msg.sender, amount.sub(fee)));

        emit Borrow(msg.sender, amount, fee);
    }
}
