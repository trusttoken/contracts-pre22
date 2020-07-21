// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {FinancialOpportunity} from "../FinancialOpportunity.sol";
import {InstantiatableOwnable} from "../../truecurrencies/modularERC20/InstantiatableOwnable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

contract ConfigurableFinancialOpportunityMock is FinancialOpportunity, InstantiatableOwnable {
    using SafeMath for uint256;

    IERC20 token;
    uint256 supply;
    uint256 tokenValueField = 1 * 10**18;

    constructor(IERC20 _token) public {
        token = _token;
    }

    function deposit(address _from, uint256 _amount) external override returns (uint256) {
        uint256 shares = _getAmountInShares(_amount);
        require(token.transferFrom(_from, address(this), _amount), "FinOpMock/deposit/transferFrom");
        supply = supply.add(shares);
        return shares;
    }

    function redeem(address _to, uint256 ztusd) external override returns (uint256) {
        uint256 tusd = _getSharesAmount(ztusd);
        require(ztusd <= supply, "FinOpMock/withdrawTo/balanceCheck");
        supply = supply.sub(ztusd);
        require(token.transfer(_to, tusd), "FinOpMock/withdrawTo/transfer");
        return tusd;
    }

    function tokenValue() external override view returns (uint256) {
        return tokenValueField;
    }

    function totalSupply() external override view returns (uint256) {
        return supply;
    }

    function increaseTokenValue(uint256 _by) external {
        tokenValueField = tokenValueField.add(_by);
    }

    function reduceTokenValue(uint256 _by) external {
        tokenValueField = tokenValueField.sub(_by);
    }

    function _getAmountInShares(uint256 _amount) internal view returns (uint256) {
        return _amount.mul(10**18).div(tokenValueField);
    }

    function _getSharesAmount(uint256 _shares) internal view returns (uint256) {
        return _shares.mul(tokenValueField).div(10**18);
    }
}
