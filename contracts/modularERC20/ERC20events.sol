pragma solidity ^0.4.23;

/*
Allows TrueUSD to emit events from the base contract.
Instead of emitting the event directly in transfer function,
the transfer functions calls emitTransferEvent. This way events
can always be emitted from the the base contract even after we delegate
calls to a new contract
*/
contract ERC20events {
    address public eventDelegate = address(this);

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 value
    );

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );

    modifier onlyTusd() {
        require(msg.sender == eventDelegate, "only event delegator can call to emit event");
        _;
    }
    
    function emitTransferEvent(address _from, address _to, uint256 _value) public onlyTusd {
        emit Transfer(_from, _to, _value);
    }
    
    function emitApprovalEvent(address _tokenHolder, address _spender, uint256 _value) public onlyTusd {
        emit Approval(_tokenHolder, _spender, _value);
    }
}
