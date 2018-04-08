pragma solidity ^0.4.18;

import "./AddressList.sol";
import "./modularERC20/ModularBurnableToken.sol";
import "./modularERC20/ModularMintableToken.sol";

contract GatedToken is ModularMintableToken, ModularBurnableToken {
    AddressList public canReceiveMintWhiteList;
    AddressList public canBurnWhiteList;
    AddressList public blackList;

    event SetLists(address indexed mintList, address indexed burnList, address indexed blackList);
    event WipeBlacklistedAccount(address indexed account, uint256 balance);

    function setLists(AddressList _canReceiveMintWhiteList, AddressList _canBurnWhiteList, AddressList _blackList) onlyOwner public {
        canReceiveMintWhiteList = _canReceiveMintWhiteList;
        canBurnWhiteList = _canBurnWhiteList;
        blackList = _blackList;
        emit SetLists(_canReceiveMintWhiteList, _canBurnWhiteList, _blackList);
    }

    function burnAllArgs(address _burner, uint256 _value) internal {
        require(canBurnWhiteList.onList(_burner));
        super.burnAllArgs(_burner, _value);
    }

    function mint(address _to, uint256 _amount) onlyOwner public returns (bool) {
        require(canReceiveMintWhiteList.onList(_to));
        super.mint(_to, _amount);
    }

    // A blacklisted address can't call transferFrom
    function transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        require(!blackList.onList(_spender));
        super.transferFromAllArgs(_from, _to, _value, _spender);
    }

    // transfer and transferFrom both call this function, so check blacklist here.
    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        require(!blackList.onList(_from));
        require(!blackList.onList(_to));
        super.transferAllArgs(_from, _to, _value);
    }

    function wipeBlacklistedAccount(address _account) public onlyOwner {
        require(blackList.onList(_account));
        uint256 oldValue = balanceOf(_account);
        balances.setBalance(_account, 0);
        totalSupply_ = totalSupply_.sub(oldValue);
        emit WipeBlacklistedAccount(_account, oldValue);
    }
}
