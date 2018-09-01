pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";


contract ERC20events is ERC20 {
    address public eventDelegateor = address(this);
    
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