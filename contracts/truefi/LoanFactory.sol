// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Initializable} from "./upgradeability/Initializable.sol";
import {LoanToken, IERC20} from "./LoanToken.sol";
import {ILoanFactory} from "./interface/ILoanFactory.sol";

contract LoanFactory is ILoanFactory, Initializable {
    IERC20 public currencyToken;

    mapping(address => bool) public override isLoanToken;

    event LoanTokenCreated(address contractAddress);

    function initialize(IERC20 _currencyToken) external initializer {
        currencyToken = _currencyToken;
    }

    function createLoanToken(
        address _borrower,
        uint256 _amount,
        uint256 _duration,
        uint256 _apy
    ) external override {
        address newToken = address(new LoanToken(currencyToken, _borrower, _amount, _duration, _apy));
        isLoanToken[newToken] = true;

        emit LoanTokenCreated(newToken);
    }
}
