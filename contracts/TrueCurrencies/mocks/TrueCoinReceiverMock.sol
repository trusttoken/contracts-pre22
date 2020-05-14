pragma solidity ^0.5.13;

contract TrueCoinReceiverMock {

    event TokenReceived(address from, uint256 value);

    uint public state;
    address public sender;

    function tokenFallback( address _from, uint256 _value ) external {
        //test what happends if the trigger fails
        require (_value > 10 * 10 ** 18);
        state = _value;
        sender = _from;
        emit TokenReceived(_from, _value);
    }
}
