pragma solidity ^0.4.24;

contract TrueCoinReceiverMock {

    event TokenReceived(address from, uint256 value);

    uint public state;

    function tokenFallback( address _from, uint256 _value ) external {
        state = _value;
        emit TokenReceived(_from, _value);
    }
}
