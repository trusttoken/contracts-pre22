pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";

/*
 */
contract GasRefundToken is ModularPausableToken {

    function sponserGas() external {
        uint256 len = gasRefundPool.length;
        gasRefundPool.length = len + 9;
        gasRefundPool[len] = 1;
        gasRefundPool[len + 1] = 1;
        gasRefundPool[len + 2] = 1;
        gasRefundPool[len + 3] = 1;
        gasRefundPool[len + 4] = 1;
        gasRefundPool[len + 5] = 1;
        gasRefundPool[len + 6] = 1;
        gasRefundPool[len + 7] = 1;
        gasRefundPool[len + 8] = 1;
    }  

    modifier gasRefund {
        uint256 len = gasRefundPool.length;
        if (len != 0) {
            gasRefundPool[--len] = 0;
            gasRefundPool[--len] = 0;
            gasRefundPool[--len] = 0;
            gasRefundPool.length = len;
        }   
        _;  
    }

    function remainingGasRefundPool() public view returns(uint) {
        return gasRefundPool.length;
    }

    function transferAllArgs(address _from, address _to, uint256 _value) internal gasRefund {
        super.transferAllArgs(_from, _to, _value);
    }
}
