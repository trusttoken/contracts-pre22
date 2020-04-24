pragma solidity ^0.5.13;

import "../FinancialOpportunity.sol";
import "../../TrueCurrencies/modularERC20/InstantiatableOwnable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract ConfigurableFinancialOpportunityMock is FinancialOpportunity, InstantiatableOwnable {
    using SafeMath for uint;

    IERC20 token;
    uint balance;
    uint perTokenValueField = 1*10**18;

    constructor(IERC20 _token) public {
        token = _token;
    }

    function deposit(address _from, uint _amount) external returns(uint) {
        uint shares = _getAmountInShares(_amount);
        require(token.transferFrom(_from, address(this), _amount), "FinOpMock/deposit/transferFrom");
        balance = balance.add(shares);
        return shares;
    }

    function withdrawTo(address _to, uint _amount) external returns(uint) {
        uint shares = _getAmountInShares(_amount);
        require(shares <= balance, "FinOpMock/withdrawTo/balanceCheck");
        require(token.transfer(_to, _amount), "FinOpMock/withdrawTo/transfer");
        balance = balance.sub(shares);
        return shares;
    }

    function withdrawAll(address _to) external returns(uint) {
        uint shares = balance;
        uint tokens = _getSharesAmount(shares);
        require(token.transfer(_to, tokens), "FinOpMock/withdrawAll/trasfer");
        balance = 0;
        return shares;
    }

    function perTokenValue() external view returns(uint) {
        return perTokenValueField;
    }

    function getBalance() external view returns(uint) {
        return balance;
    }

    function increasePerTokenValue(uint _by) external {
        perTokenValueField = perTokenValueField.add(_by);
    }

    function _getAmountInShares(uint _amount) internal view returns (uint) {
        return _amount.mul(10**18).div(perTokenValueField);
    }

    function _getSharesAmount(uint _shares) internal view returns (uint) {
        return _shares.mul(perTokenValueField).div(10**18);
    }
}
