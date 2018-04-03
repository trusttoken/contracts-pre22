pragma solidity ^0.4.18;

import "../zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
import "../zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "../zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
// TrueUSD *is* supposed to own 'balances' and 'allowances', but it needs to be able to relinquish them:
import "../zeppelin-solidity/contracts/ownership/NoOwner.sol";
import "./AddressList.sol";
import "./StandardDelegate.sol";
import "./CanDelegate.sol";
import "./TokenWithFees.sol";

contract TrueUSD is StandardDelegate, PausableToken, TokenWithFees, NoOwner, CanDelegate {
    string public name = "TrueUSD";
    string public symbol = "TUSD";
    uint8 public constant decimals = 18;

    AddressList public canReceiveMintWhiteList;
    AddressList public canBurnWhiteList;
    AddressList public blackList;
    uint256 public burnMin = 10000 * 10**uint256(decimals);
    uint256 public burnMax = 20000000 * 10**uint256(decimals);

    event ChangeBurnBoundsEvent(uint256 newMin, uint256 newMax);
    event Mint(address indexed to, uint256 amount);
    event WipedAccount(address indexed account, uint256 balance);

    function TrueUSD() public {
        totalSupply_ = 0;
    }

    function setLists(AddressList _canReceiveMintWhiteList, AddressList _canBurnWhiteList, AddressList _blackList, AddressList _noFeesList) onlyOwner public {
        canReceiveMintWhiteList = _canReceiveMintWhiteList;
        canBurnWhiteList = _canBurnWhiteList;
        blackList = _blackList;
        noFeesList = _noFeesList;
    }

    function changeName(string _name, string _symbol) onlyOwner public {
        name = _name;
        symbol = _symbol;
    }

    //Burning functions as withdrawing money from the system. The platform will keep track of who burns coins,
    //and will send them back the equivalent amount of money (rounded down to the nearest cent).
    //The API for burning is inherited: burn(uint256 _value)
    function burnAllArgs(address burner, uint256 _value) internal {
        require(canBurnWhiteList.onList(burner));
        require(_value >= burnMin);
        require(_value <= burnMax);
        super.burnAllArgs(burner, _value);
    }

    //Create _amount new tokens and transfer them to _to.
    function mint(address _to, uint256 _amount) onlyOwner public returns (bool) {
        require(canReceiveMintWhiteList.onList(_to));
        super.mint(_to, _amount);
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

    // A blacklisted address can't call transferFrom
    function transferAllArgsYesAllowance(address _from, address _to, uint256 _value, address spender) internal {
        require(!blackList.onList(spender));
        super.transferAllArgsYesAllowance(_from, _to, _value, spender);
    }

    // transfer and transferFrom both ultimately call this function, so we
    // check blacklist and pay staking fee here.
    function transferAllArgsNoAllowance(address _from, address _to, uint256 _value) internal {
        require(!blackList.onList(_from));
        require(!blackList.onList(_to));
        super.transferAllArgsNoAllowance(_from, _to, _value);
    }

    function wipeBlacklistedAccount(address account) public onlyOwner {
        require(blackList.onList(account));
        uint256 oldValue = balanceOf(account);
        balances.setBalance(account, 0);
        totalSupply_ = totalSupply_.sub(oldValue);
        WipedAccount(account, oldValue);
    }
}
