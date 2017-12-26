pragma solidity ^0.4.17;

import 'zeppelin-solidity/contracts/token/MintableToken.sol';
import 'zeppelin-solidity/contracts/token/BurnableToken.sol';
import './WhiteList.sol';

contract TrueUSD is MintableToken, BurnableToken {
    string public name = "TrueUSD";
    string public symbol = "TUSD";
    uint8 public decimals = 18;
    uint public INITIAL_SUPPLY = 0;
    address public canMintWhiteList;
    address public canBurnWhiteList;

    function TrueUSD(address _canMintWhiteList, address _canBurnWhiteList) public {
        totalSupply = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
        canMintWhiteList = _canMintWhiteList;
        canBurnWhiteList = _canBurnWhiteList;
    }

    //Burning functions as withdrawing money from the system. The platform will keep track of who burns coins,
    //and will send them back the equivalent amount of money.
    function burn(uint256 _value) public {
        require(WhiteList(canBurnWhiteList).hasAccess(msg.sender) == true);
        require(_value <= balances[msg.sender]);
        address burner = msg.sender;
        balances[burner] = balances[burner].sub(_value);
        totalSupply = totalSupply.sub(_value);
        Burn(burner, _value);
    }

    function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {
        require(WhiteList(canMintWhiteList).hasAccess(msg.sender) == true);
        totalSupply = totalSupply.add(_amount);
        balances[_to] = balances[_to].add(_amount);
        Mint(_to, _amount);
        Transfer(address(0), _to, _amount);
        return true;
  }
}