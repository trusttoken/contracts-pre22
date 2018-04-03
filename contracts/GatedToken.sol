pragma solidity ^0.4.18;

import "./AddressList.sol";
import "./TokenWithFees.sol";
// import "../zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
// import "../zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";

contract GatedToken is TokenWithFees {
    AddressList public canReceiveMintWhiteList;
    AddressList public canBurnWhiteList;
    AddressList public blackList;

    event WipedAccount(address indexed account, uint256 balance);

    function setLists(AddressList _canReceiveMintWhiteList, AddressList _canBurnWhiteList, AddressList _blackList) onlyOwner public {
        canReceiveMintWhiteList = _canReceiveMintWhiteList;
        canBurnWhiteList = _canBurnWhiteList;
        blackList = _blackList;
    }

    function burnAllArgs(address burner, uint256 _value) internal {
        require(canBurnWhiteList.onList(burner));
        super.burnAllArgs(burner, _value);
    }

    function mint(address _to, uint256 _amount) onlyOwner public returns (bool) {
        require(canReceiveMintWhiteList.onList(_to));
        super.mint(_to, _amount);
    }

    // A blacklisted address can't call transferFrom
    function transferAllArgsYesAllowance(address _from, address _to, uint256 _value, address spender) internal {
        require(!blackList.onList(spender));
        super.transferAllArgsYesAllowance(_from, _to, _value, spender);
    }

    // transfer and transferFrom both call this function, so check blacklist here.
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
