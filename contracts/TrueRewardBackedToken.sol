pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";

contract TrueRewardBackedToken is CompliantDepositTokenWithHook {
    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        // require(1==0,"revert");
        super._transferAllArgs(_from, _to, _value);
    }
}