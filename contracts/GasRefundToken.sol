pragma solidity ^0.4.23;

import "./ProxyStorage.sol";

/**  
@title Gas Refund Token
Allow any user to sponsor gas refunds for transfer and mints. Utilitzes the gas refund mechanism in EVM
Each time an non-empty storage slot is set to 0, evm refund 15,000 (19,000 after Constantinople) to the sender
of the transaction. 
*/
contract GasRefundToken is ProxyStorage {

    function sponsorGas() external {
        uint256 len = gasRefundPool.length;
        uint256 refundPrice = minimumGasPriceForFutureRefunds;
        require(refundPrice > 0);
        gasRefundPool.length = len + 9;
        gasRefundPool[len] = refundPrice;
        gasRefundPool[len + 1] = refundPrice;
        gasRefundPool[len + 2] = refundPrice;
        gasRefundPool[len + 3] = refundPrice;
        gasRefundPool[len + 4] = refundPrice;
        gasRefundPool[len + 5] = refundPrice;
        gasRefundPool[len + 6] = refundPrice;
        gasRefundPool[len + 7] = refundPrice;
        gasRefundPool[len + 8] = refundPrice;
    }

    function minimumGasPriceForRefund() public view returns (uint256) {
        uint256 len = gasRefundPool.length;
        if (len > 0) {
          return gasRefundPool[len - 1] + 1;
        }
        return uint256(-1);
    }

    /**  
    @dev refund 45,000 gas for functions with gasRefund modifier.
    @dev costs slightly more than 20,000 gas
    */
    function gasRefund45() internal {
        uint256 len = gasRefundPool.length;
        if (len > 2 && tx.gasprice > gasRefundPool[len-1]) {
            gasRefundPool.length = len - 3;
        }
    }

    /**  
    @dev refund 30,000 gas for functions with gasRefund modifier.
    @dev costs slightly more than 15,000 gas
    */
    function gasRefund30() internal {
        uint256 len = gasRefundPool.length;
        if (len > 1 && tx.gasprice > gasRefundPool[len-1]) {
            gasRefundPool.length = len - 2;
        }
    }

    /**  
    @dev refund 15,000 gas for functions with gasRefund modifier.
    @dev costs slightly more than 10,000 gas
    */
    function gasRefund15() internal {
        uint256 len = gasRefundPool.length;
        if (len > 0 && tx.gasprice > gasRefundPool[len-1]) {
            gasRefundPool.length = len - 1;
        }
    }

    /**  
    *@dev Return the remaining sponsored gas slots
    */
    function remainingGasRefundPool() public view returns (uint) {
        return gasRefundPool.length;
    }

    bytes32 constant CAN_SET_FUTURE_REFUND_MIN_GAS_PRICE = "canSetFutureRefundMinGasPrice";

    function setMinimumGasPriceForFutureRefunds(uint256 _minimumGasPriceForFutureRefunds) public {
        require(registry.hasAttribute(msg.sender, CAN_SET_FUTURE_REFUND_MIN_GAS_PRICE));
        minimumGasPriceForFutureRefunds = _minimumGasPriceForFutureRefunds;
    }
}
