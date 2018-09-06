pragma solidity ^0.4.23;


contract ERC20events {
    address public eventDelegateor = address(this);

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

    modifier onlyTusd(){
        require(msg.sender == eventDelegateor);
        _;
    }
    
    function emitTransferEvent(address _from, address _to, uint256 _value) public onlyTusd {
        emit Transfer(_from, _to, _value);
    }
    
    function emitApprovalEvent(address _tokenHolder, address _spender, uint256 _value) public onlyTusd {
        emit Approval(_tokenHolder, _spender, _value);
    }

}
