// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "../common/UpgradeableERC20.sol";
import {IDebtToken} from "./interface/ILoanToken2.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";

contract DebtToken is IDebtToken, ERC20 {
    function initialize() external initializer {}

    function borrower() external override view returns (address) {}

    function amount() external override view returns (uint256) {}

    function debt() external override view returns (uint256) {}

    function pool() external override view returns (ITrueFiPool2) {}

    function status() external override view returns (Status) {}

    function redeem(uint256 _amount) external override {}

    function repay(address _sender, uint256 _amount) external override {}

    function repayInFull(address _sender) external override {}

    function reclaim() external override {}

    function liquidate() external override {}

    function repaid() external override view returns (uint256) {}

    function isRepaid() external override view returns (bool) {}

    function balance() external override view returns (uint256) {}

    function value(uint256 _balance) external override view returns (uint256) {}

    function token() external override view returns (ERC20) {}

    function version() external override pure returns (uint8) {}
}
