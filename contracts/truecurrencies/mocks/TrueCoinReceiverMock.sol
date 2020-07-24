// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

contract TrueCoinReceiverMock {
    event TokenReceived(address from, uint256 value);

    uint256 public state;
    address public sender;

    function tokenFallback(address _from, uint256 _value) external {
        // test what happens if the trigger fails
        require(_value > 10 * 10**18);
        state = _value;
        sender = _from;
        emit TokenReceived(_from, _value);
    }
}
