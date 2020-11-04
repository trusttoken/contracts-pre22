// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {GasRefund} from "./common/GasRefund.sol";

import {TrueCurrency} from "./TrueCurrency.sol";

abstract contract TrueCurrencyWithGasRefund is GasRefund, TrueCurrency {
    /**
     * @dev reclaim gas from legacy gas refund #1
     * will refund 15,000 * amount gas to sender (minus exection cost)
     * If gas pool is empty, refund 39,000 * amount gas by calling selfdestruct
     */
    function refundGas(uint256 amount) external onlyOwner {
        if (remainingGasRefundPool() > 0) {
            gasRefund15(amount);
        } else {
            gasRefund39(amount.div(3));
        }
    }
}
