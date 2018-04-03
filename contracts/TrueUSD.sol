pragma solidity ^0.4.18;

import "../zeppelin-solidity/contracts/token/ERC20/PausableToken.sol";
// TrueUSD *is* supposed to own 'balances' and 'allowances', but it needs to be able to relinquish them:
import "../zeppelin-solidity/contracts/ownership/NoOwner.sol";
import "./CanDelegate.sol";

contract TrueUSD is PausableToken, NoOwner, CanDelegate {
    string public name = "TrueUSD";
    string public symbol = "TUSD";
    uint8 public constant decimals = 18;

    function TrueUSD() public {
        totalSupply_ = 0;
        burnMin = 10000 * 10**uint256(decimals);
        burnMax = 20000000 * 10**uint256(decimals);
    }

    function changeName(string _name, string _symbol) onlyOwner public {
        name = _name;
        symbol = _symbol;
    }
}
