pragma solidity ^0.5.13;

import "../FinancialOpportunity.sol";
import "../../TrueCurrencies/modularERC20/InstantiatableOwnable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract ConfigurableFinancialOpportunityMock is FinancialOpportunity, InstantiatableOwnable {
    using SafeMath for uint;

    IERC20 token;
    uint supply;
    uint tokenValueField = 1*10**18;

    constructor(IERC20 _token) public {
        token = _token;
    }

    function deposit(address _from, uint _amount) external returns(uint) {
        uint shares = _getAmountInShares(_amount);
        require(token.transferFrom(_from, address(this), _amount), "FinOpMock/deposit/transferFrom");
        supply = supply.add(shares);
        return shares;
    }

    function redeem(address _to, uint ztusd) external returns(uint) {
        uint tusd = _getSharesAmount(ztusd);
        require(ztusd <= supply, "FinOpMock/withdrawTo/balanceCheck");
        require(token.transfer(_to, tusd), "FinOpMock/withdrawTo/transfer");
        supply = supply.sub(ztusd);
        return tusd;
    }

    function tokenValue() external view returns(uint) {
        return tokenValueField;
    }

    function totalSupply() external view returns(uint) {
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
