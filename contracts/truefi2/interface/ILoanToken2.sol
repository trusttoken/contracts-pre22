// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "../../common/UpgradeableERC20.sol";
import {ITrueFiPool2} from "./ITrueFiPool2.sol";

interface ILoanToken2 is IERC20 {
    enum Status {Withdrawn, Settled, Defaulted}

    function term() external view returns (uint256);

    function apy() external view returns (uint256);

    function amount() external view returns (uint256);

    function start() external view returns (uint256);

    function lender() external view returns (address);

    function profit() external view returns (uint256);

    function repaid() external view returns (uint256);

    function balance() external view returns (uint256);

    function version() external pure returns (uint8);

    function redeem(uint256) external;

    function borrower() external view returns (address);

    function debt() external view returns (uint256);

    function status() external view returns (Status);

    function token() external view returns (ERC20);

    function pool() external view returns (ITrueFiPool2);

    function repay(address _sender, uint256 _amount) external;

    function repayInFull(address _sender) external;

    function value(uint256 _balance) external view returns (uint256);

    function getParameters()
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    function settle() external;

    function enterDefault() external;

    function reclaim() external;

    function isRepaid() external view returns (bool);

    function allowTransfer(address account, bool _status) external;
}
