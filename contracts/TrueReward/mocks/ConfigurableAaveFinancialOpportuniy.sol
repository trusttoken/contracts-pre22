pragma solidity 0.5.13;

import "../AaveFinancialOpportunity.sol";

contract ConfigurableAaveFinancialOpportunity is AaveFinancialOpportunity {
    using SafeMath for uint;

    uint supply;
    uint tokenValueField;

    function configure(
        IAToken _aToken,
        ILendingPool _lendingPool,
        TrueUSD _token,
        address _owner
    ) public onlyProxyOwner {
        super.configure(_aToken, _lendingPool, _token, _owner);
        tokenValueField = 1*10**18;
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

    function tokenValue() public view returns(uint) {
        return tokenValueField;
    }

    function totalSupply() public view returns(uint) {
        return supply;
    }

    function increaseTokenValue(uint _by) external {
        tokenValueField = tokenValueField.add(_by);
    }

    function _getAmountInShares(uint _amount) internal view returns (uint) {
        return _amount.mul(10**18).div(tokenValueField);
    }

    function _getSharesAmount(uint _shares) internal view returns (uint) {
        return _shares.mul(tokenValueField).div(10**18);
    }
}
