// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import "../strategies/CurveYearnStrategy.sol";

/// @dev Test helper that allows using any wallet as a pool
contract TestCurveStrategy is CurveYearnStrategy {
    function testInitialize(
        IERC20WithDecimals _token,
        address _pool,
        ICurvePool _curvePool,
        ICurveGauge _curveGauge,
        ICurveMinter _minter,
        I1Inch3 _1inchExchange,
        ICrvPriceOracle _crvOracle,
        uint8 _tokenIndex
    ) external initializer {
        UpgradeableClaimable.initialize(msg.sender);

        token = _token;
        pool = _pool;

        curvePool = _curvePool;
        curveGauge = _curveGauge;
        minter = _minter;
        _1Inch = _1inchExchange;
        crvOracle = _crvOracle;
        tokenIndex = _tokenIndex;
    }
}
