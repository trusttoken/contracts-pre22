// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILoanToken is IERC20 {
    enum Status {Awaiting, Funded, Withdrawn, Settled, Defaulted}

    function borrower() external view returns (address);

    function amount() external view returns (uint256);

    function duration() external view returns (uint256);

    function apy() external view returns (uint256);

    function status() external view returns (Status);

    function isLoanToken() external pure returns (bool);

    function getParameters()
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    function fund() external;

    function reclaim(uint256 _amount) external;

    function withdraw(address _beneficiary) external;

    function close() external;

    function redeem(uint256 _amount) external;

    function repay(address _sender, uint256 _amount) external;

    function allowTransfer(address account, bool _status) external;

    function repaid() external view returns (uint256);

    function balance() external view returns (uint256);
}
