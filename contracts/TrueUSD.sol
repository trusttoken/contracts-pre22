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

    uint16 insuranceFeeBips;
    address insurer;

    function TrueUSD(address _canMintWhiteList, address _canBurnWhiteList, address _blackList) public {
        totalSupply = INITIAL_SUPPLY;
        canReceiveMintWhitelist = AddressList(_canMintWhiteList);
        canBurnWhiteList = AddressList(_canBurnWhiteList);
        blackList = AddressList(_blackList);
        insuranceFeeBips = 7;
        insurer = msg.sender;
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
        uint256 insuranceFee = value.mul(insuranceFeeBips).div(10000);
        value = value.sub(insuranceFee);
        super.transfer(insurer, insuranceFee);
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(!blackList.onList(from));
        require(!blackList.onList(to));
        uint256 insuranceFee = value.mul(insuranceFeeBips).div(10000);
        value = value.sub(insuranceFee);
        super.transferFrom(from, insurer, insuranceFee);
        return super.transferFrom(from, to, value);
    }

    function changeInsuranceFee(uint16 newInsuranceFeeBips) public onlyOwner {
        insuranceFeeBips = newInsuranceFeeBips;
    }

    function changeInsurer(address newInsurer) public onlyOwner {
        insurer = newInsurer;
    }
}
