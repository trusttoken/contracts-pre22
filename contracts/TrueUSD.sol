pragma solidity ^0.4.18;

import 'zeppelin-solidity/contracts/token/MintableToken.sol';
import 'zeppelin-solidity/contracts/token/BurnableToken.sol';
import 'zeppelin-solidity/contracts/ownership/NoOwner.sol';
import './AddressList.sol';

contract TrueUSD is MintableToken, BurnableToken, NoOwner {
    string public constant name = "TrueUSD";
    string public constant symbol = "TUSD";
    uint8 public constant decimals = 18;

    AddressList public canReceiveMintWhitelist;
    AddressList public canBurnWhiteList;
    AddressList public blackList;
    uint public burnMin = 10000 * uint256(10)**decimals;
    uint public burnMax = 20000000 * uint256(10)**decimals;

    uint80 public insuranceFeeNumerator;
    uint80 public insuranceFeeDenominator;
    address public insurer;

    event ChangeBurnBoundsEvent(uint newMin, uint newMax);

    function TrueUSD(address _canMintWhiteList, address _canBurnWhiteList, address _blackList) public {
        totalSupply = 0;
        canReceiveMintWhitelist = AddressList(_canMintWhiteList);
        canBurnWhiteList = AddressList(_canBurnWhiteList);
        blackList = AddressList(_blackList);
        insuranceFeeNumerator = 7;
        insuranceFeeDenominator = 10000;
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

    //Change the minimum and maximum amount that can be burned at once. Burning
    //may be disabled by setting both to 0 (this will not be done under normal
    //operation, but we can't add checks to disallow it without losing a lot of
    //flexibility since burning could also be as good as disabled
    //by setting the minimum extremely high, and we don't want to lock
    //in any particular cap for the minimum)
    function changeBurnBounds(uint newMin, uint newMax) onlyOwner public {
        require(newMin <= newMax);
        burnMin = newMin;
        burnMax = newMax;
        ChangeBurnBoundsEvent(newMin, newMax);
    }

    function transfer(address to, uint256 value) public returns (bool) {
        require(!blackList.onList(msg.sender));
        require(!blackList.onList(to));
        uint256 insuranceFee = value.mul(insuranceFeeNumerator).div(insuranceFeeDenominator);
        value = value.sub(insuranceFee);
        super.transfer(insurer, insuranceFee);
        return super.transfer(to, value);
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(!blackList.onList(from));
        require(!blackList.onList(to));
        uint256 insuranceFee = value.mul(insuranceFeeNumerator).div(insuranceFeeDenominator);
        value = value.sub(insuranceFee);
        super.transferFrom(from, insurer, insuranceFee);
        return super.transferFrom(from, to, value);
    }

    function changeInsuranceFee(uint80 newNumerator, uint80 newDenominator) public onlyOwner {
        insuranceFeeNumerator = newNumerator;
        insuranceFeeDenominator = newDenominator;
    }

    function changeInsurer(address newInsurer) public onlyOwner {
        insurer = newInsurer;
    }
}
