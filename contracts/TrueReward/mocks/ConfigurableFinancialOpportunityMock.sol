// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "../FinancialOpportunity.sol";
import "../../TrueCurrencies/modularERC20/InstantiatableOwnable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

contract ConfigurableFinancialOpportunityMock is FinancialOpportunity, InstantiatableOwnable {
    using SafeMath for uint;

    IERC20 token;
    uint supply;
    uint tokenValueField = 1*10**18;

    constructor(IERC20 _token) public {
        token = _token;
    }

    function deposit(address _from, uint _amount) override external returns(uint) {
        uint shares = _getAmountInShares(_amount);
        require(token.transferFrom(_from, address(this), _amount), "FinOpMock/deposit/transferFrom");
        supply = supply.add(shares);
        return shares;
    }

    function redeem(address _to, uint ztusd) override external returns(uint) {
        uint tusd = _getSharesAmount(ztusd);
        require(ztusd <= supply, "FinOpMock/withdrawTo/balanceCheck");
        require(token.transfer(_to, tusd), "FinOpMock/withdrawTo/transfer");
        supply = supply.sub(ztusd);
        return tusd;
    }

    function tokenValue() override external view returns(uint) {
        return tokenValueField;
    }

    function totalSupply() override external view returns(uint) {
        return supply;
    }

    function increaseTokenValue(uint _by) external {
        tokenValueField = tokenValueField.add(_by);
    }

    function reduceTokenValue(uint _by) external {
        tokenValueField = tokenValueField.sub(_by);
    }

    function _getAmountInShares(uint _amount) internal view returns (uint) {
        return _amount.mul(10**18).div(tokenValueField);
    }

    function _getSharesAmount(uint _shares) internal view returns (uint) {
        return _shares.mul(tokenValueField).div(10**18);
    }
}
