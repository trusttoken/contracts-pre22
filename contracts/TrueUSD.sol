pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "zeppelin-solidity/contracts/ownership/NoOwner.sol";
import "./AddressList.sol";

contract TrueUSD is PausableToken, BurnableToken, NoOwner {
    string public constant name = "TrueUSD";
    string public constant symbol = "TUSD";
    uint8 public constant decimals = 18;

    AddressList public canReceiveMintWhitelist;
    AddressList public canBurnWhiteList;
    AddressList public blackList;
    uint256 public burnMin = 10000 * 10**uint256(decimals);
    uint256 public burnMax = 20000000 * 10**uint256(decimals);

    uint80 public transferFeeNumerator = 7;
    uint80 public transferFeeDenominator = 10000;
    uint80 public mintFeeNumerator = 0;
    uint80 public mintFeeDenominator = 10000;
    uint256 public mintFeeFlat = 0;
    uint80 public burnFeeNumerator = 0;
    uint80 public burnFeeDenominator = 10000;
    uint256 public burnFeeFlat = 0;
    address public insurer;

    event ChangeBurnBoundsEvent(uint256 newMin, uint256 newMax);
    event Mint(address indexed to, uint256 amount);

    function TrueUSD(address _canMintWhiteList, address _canBurnWhiteList, address _blackList) public {
        totalSupply_ = 0;
        canReceiveMintWhitelist = AddressList(_canMintWhiteList);
        canBurnWhiteList = AddressList(_canBurnWhiteList);
        blackList = AddressList(_blackList);
        insurer = msg.sender;
    }

    //Burning functions as withdrawing money from the system. The platform will keep track of who burns coins,
    //and will send them back the equivalent amount of money (rounded down to the nearest cent).
    function burn(uint256 _value) public {
        require(canBurnWhiteList.onList(msg.sender));
        require(_value >= burnMin);
        require(_value <= burnMax);
        uint256 fee = payInsuranceFee(msg.sender, _value, burnFeeNumerator, burnFeeDenominator, burnFeeFlat);
        _value = _value.sub(fee);
        super.burn(_value);
    }

    //Create _amount new tokens and transfer them to _to.
    //Based on code by OpenZeppelin: https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/token/MintableToken.sol
    function mint(address _to, uint256 _amount) onlyOwner public {
        require(canReceiveMintWhitelist.onList(_to));
        totalSupply_ = totalSupply_.add(_amount);
        balances[_to] = balances[_to].add(_amount);
        Mint(_to, _amount);
        Transfer(address(0), _to, _amount);
        payInsuranceFee(_to, _amount, mintFeeNumerator, mintFeeDenominator, mintFeeFlat);
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
        bool result = super.transfer(to, value);
        payInsuranceFee(to, value, transferFeeNumerator, transferFeeDenominator, 0);
        return result;
    }

    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        require(!blackList.onList(from));
        require(!blackList.onList(to));
        bool result = super.transferFrom(from, to, value);
        payInsuranceFee(to, value, transferFeeNumerator, transferFeeDenominator, 0);
        return result;
    }

    function payInsuranceFee(address payer, uint256 value, uint80 numerator, uint80 denominator, uint256 flatRate) private returns (uint256 insuranceFee) {
        insuranceFee = value.mul(numerator).div(denominator).add(flatRate);
        if (insuranceFee > 0) {
            transferFromWithoutAllowance(payer, insurer, insuranceFee);
        }
    }

    // based on 'transfer' in https://github.com/OpenZeppelin/zeppelin-solidity/blob/master/contracts/token/ERC20/BasicToken.sol
    function transferFromWithoutAllowance(address from, address _to, uint256 _value) private {
        assert(_to != address(0));
        assert(_value <= balances[from]);
        balances[from] = balances[from].sub(_value);
        balances[_to] = balances[_to].add(_value);
        Transfer(from, _to, _value);
    }

    function changeInsuranceFees(uint80 _transferFeeNumerator,
                                 uint80 _transferFeeDenominator,
                                 uint80 _mintFeeNumerator,
                                 uint80 _mintFeeDenominator,
                                 uint256 _mintFeeFlat,
                                 uint80 _burnFeeNumerator,
                                 uint80 _burnFeeDenominator,
                                 uint256 _burnFeeFlat) public onlyOwner {
        require(_transferFeeDenominator != 0);
        require(_mintFeeDenominator != 0);
        require(_burnFeeDenominator != 0);
        transferFeeNumerator = _transferFeeNumerator;
        transferFeeDenominator = _transferFeeDenominator;
        mintFeeNumerator = _mintFeeNumerator;
        mintFeeDenominator = _mintFeeDenominator;
        mintFeeFlat = _mintFeeFlat;
        burnFeeNumerator = _burnFeeNumerator;
        burnFeeDenominator = _burnFeeDenominator;
        burnFeeFlat = _burnFeeFlat;
    }

    function changeInsurer(address newInsurer) public onlyOwner {
        require(newInsurer != address(0));
        insurer = newInsurer;
    }
}
