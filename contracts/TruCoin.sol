pragma solidity ^0.4.17;

import 'zeppelin-solidity/contracts/token/MintableToken.sol';
import 'zeppelin-solidity/contracts/token/BurnableToken.sol';

contract TutorialToken is MintableToken, BurnableToken {
    string public name = "TruCoin";
    string public symbol = "TC";
    uint8 public decimals = 2;
    uint public INITIAL_SUPPLY = 12000;
    // mapping (address => bytes32) public keyValidations;
    mapping (address => bool) public withdrawalWhiteList;

    function TutorialToken() public {
        totalSupply = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
    }

    // event ValidateKey(address indexed account, bytes32 indexed message);

    // function validateKey(bytes32 _message) public {
    //     keyValidations[msg.sender] = _message;
    //     ValidateKey(msg.sender, _message);
    // }

    event ChangeWithdrawalWhiteList(address indexed to, bool canWithdraw);

    function changeWithdrawalWhiteList(address _to, bool _canWithdraw) public {
        withdrawalWhiteList[_to] = _canWithdraw;
        ChangeWithdrawalWhiteList(_to, _canWithdraw);
    }

    //Burning functions as withdrawing money from the system. The platform will keep track of who burns coins,
    //and will send them back the equivalent amount of money.
    function burn(uint256 _value) public {
        require(_value <= balances[msg.sender]);
        require(withdrawalWhiteList[msg.sender] == true);
        // no need to require value <= totalSupply, since that would imply the
        // sender's balance is greater than the totalSupply, which *should* be an assertion failure

        address burner = msg.sender;
        balances[burner] = balances[burner].sub(_value);
        totalSupply = totalSupply.sub(_value);
        Burn(burner, _value);
    }
}