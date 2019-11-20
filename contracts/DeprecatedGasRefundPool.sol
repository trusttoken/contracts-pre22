pragma solidity^0.5.13;

import "./HasOwner.sol";

contract DeprecatedGasRefundPool is ProxyStorage {
    modifier retroGasRefund15 {
        _;
        uint256 len = gasRefundPool_Deprecated.length;
        if (len > 0 && tx.gasprice > gasRefundPool_Deprecated[len-1]) {
            gasRefundPool_Deprecated.length = len - 1;
        }
    }
    modifier retroGasRefund30 {
        _;
        uint256 len = gasRefundPool_Deprecated.length;
        if (len > 1 && tx.gasprice > gasRefundPool_Deprecated[len-1]) {
            gasRefundPool_Deprecated.length = len - 2;
        }
    }
    modifier retroGasRefund45 {
        _;
        uint256 len = gasRefundPool_Deprecated.length;
        if (len > 2 && tx.gasprice > gasRefundPool_Deprecated[len-1]) {
            gasRefundPool_Deprecated.length = len - 3;
        }
    }
    modifier retroSponsorGas {
        uint256 refundPrice = minimumGasPriceForFutureRefunds;
        require(refundPrice > 0);
        uint256 len = gasRefundPool_Deprecated.length;
        gasRefundPool_Deprecated.length = len + 9;
        gasRefundPool_Deprecated[len] = refundPrice;
        gasRefundPool_Deprecated[len + 1] = refundPrice;
        gasRefundPool_Deprecated[len + 2] = refundPrice;
        gasRefundPool_Deprecated[len + 3] = refundPrice;
        gasRefundPool_Deprecated[len + 4] = refundPrice;
        gasRefundPool_Deprecated[len + 5] = refundPrice;
        gasRefundPool_Deprecated[len + 6] = refundPrice;
        gasRefundPool_Deprecated[len + 7] = refundPrice;
        gasRefundPool_Deprecated[len + 8] = refundPrice;
        _;
    }
    function retroGasPoolRemaining() internal view returns (uint256) {
        return gasRefundPool_Deprecated.length;
    }
}
