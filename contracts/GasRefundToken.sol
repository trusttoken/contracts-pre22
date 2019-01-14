pragma solidity ^0.4.23;

import "./modularERC20/ModularMintableToken.sol";

/**  
@title Gas Refund Token
Allow any user to sponsor gas refunds for transfer and mints. Utilitzes the gas refund mechanism in EVM
Each time an non-empty storage slot is set to 0, evm refund 15,000 (19,000 after Constantinople) to the sender
of the transaction. 
*/
contract GasRefundToken is ModularMintableToken {

    function sponsorGas() external {
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

    /**  
    @dev refund 45,000 gas for functions with gasRefund modifier.
    */
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

    /**  
    *@dev Return the remaining sponsored gas slots
    */
    function remainingGasRefundPool() public view returns(uint) {
        return gasRefundPool.length;
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal gasRefund {
        super._transferAllArgs(_from, _to, _value);
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _sender) internal gasRefund {
        super._transferFromAllArgs(_from, _to, _value, _sender);
    }

    function mint(address _to, uint256 _value) public onlyOwner gasRefund {
        super.mint(_to, _value);
    }
}
