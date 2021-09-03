// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "../../common/UpgradeableERC20.sol";
import {ITrueFiPool2} from "./ITrueFiPool2.sol";

// These two interfaces have to stay in a single file due to a flattener bug that causes IDebtToken to be declared before ILoanToken2
interface IDebtToken is IERC20 {
    enum Status {Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated}

    function borrower() external view returns (address);

    function amount() external view returns (uint256);

    function debt() external view returns (uint256);

    function pool() external view returns (ITrueFiPool2);

    function status() external view returns (Status);

    function redeem(uint256 _amount) external;

    function repay(address _sender, uint256 _amount) external;

    function repayInFull(address _sender) external;

    function reclaim() external;

    function liquidate() external;

    function repaid() external view returns (uint256);

    function isRepaid() external view returns (bool);

    function balance() external view returns (uint256);

    function value(uint256 _balance) external view returns (uint256);

    function token() external view returns (ERC20);

    function version() external pure returns (uint8);
}

interface ILoanToken2 is IDebtToken {
    function term() external view returns (uint256);

    function apy() external view returns (uint256);

    function start() external view returns (uint256);

    function lender() external view returns (address);

    function profit() external view returns (uint256);

    function getParameters()
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    function fund() external;

    function withdraw(address _beneficiary) external;

    function settle() external;

    function enterDefault() external;

    function allowTransfer(address account, bool _status) external;
}
