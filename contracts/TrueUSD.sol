pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/token/MintableToken.sol';
import 'zeppelin-solidity/contracts/token/BurnableToken.sol';
import 'zeppelin-solidity/contracts/ownership/NoOwner.sol';
import './AddressList.sol';

contract TrueUSD is MintableToken, BurnableToken, NoOwner {
    string public constant name = "TrueUSD";
    string public constant symbol = "TUSD";
    uint8 public constant decimals = 18;
    uint public constant INITIAL_SUPPLY = 0;

    AddressList public canReceiveMintWhitelist;
    AddressList public canBurnWhiteList;
    AddressList public blackList;
    uint burnMin = 10000 * uint256(10)**decimals;
    uint burnMax = 20000000 * uint256(10)**decimals;

    function TrueUSD(address _canMintWhiteList, address _canBurnWhiteList, address _blackList) public {
        totalSupply = INITIAL_SUPPLY;
        canReceiveMintWhitelist = AddressList(_canMintWhiteList);
        canBurnWhiteList = AddressList(_canBurnWhiteList);
        blackList = AddressList(_blackList);
    }

    //Burning functions as withdrawing money from the system. The platform will keep track of who burns coins,
    //and will send them back the equivalent amount of money (rounded down to the nearest cent).
    function burn(uint256 _value) public {
        require(canBurnWhiteList.onList(msg.sender));
        require(_value >= burnMin);
        require(_value <= burnMax);
        super.burn(_value);
    }

    function mint(address _to, uint256 _amount) onlyOwner public returns (bool) {
        require(canReceiveMintWhitelist.onList(_to));
        return super.mint(_to, _amount);
    }

    function changeBurnBounds(uint newMin, uint newMax) onlyOwner public {
        burnMin = newMin;
        burnMax = newMax;
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(!blackList.onList(msg.sender));
        require(!blackList.onList(to));
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(!blackList.onList(from));
        require(!blackList.onList(to));
        return super.transferFrom(from, to, value);
    }
}
