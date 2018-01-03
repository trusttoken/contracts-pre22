pragma solidity ^0.4.17;

import 'zeppelin-solidity/contracts/token/MintableToken.sol';
import 'zeppelin-solidity/contracts/token/BurnableToken.sol';
import 'zeppelin-solidity/contracts/ownership/NoOwner.sol';
import './WhiteList.sol';

contract TrueUSD is MintableToken, BurnableToken, NoOwner {
    string public name = "TrueUSD";
    string public symbol = "TUSD";
    uint8 public decimals = 18;
    uint public INITIAL_SUPPLY = 0;
    WhiteList public canMintWhiteList;
    WhiteList public canBurnWhiteList;

    function TrueUSD(address _canMintWhiteList, address _canBurnWhiteList) public {
        totalSupply = INITIAL_SUPPLY;
        balances[msg.sender] = INITIAL_SUPPLY;
        canMintWhiteList = WhiteList(_canMintWhiteList);
        canBurnWhiteList = WhiteList(_canBurnWhiteList);
    }

    //Burning functions as withdrawing money from the system. The platform will keep track of who burns coins,
    //and will send them back the equivalent amount of money. (TODO)
    function burn(uint256 _value) public {
        require(canBurnWhiteList.hasAccess(msg.sender));
        super.burn(_value);
    }

    function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {
        require(canMintWhiteList.hasAccess(_address));
        super.mint(_to, _amount);
    }
}