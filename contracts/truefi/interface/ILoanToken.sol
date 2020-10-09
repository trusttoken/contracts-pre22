// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILoanToken is IERC20 {
    function isLoanToken() external pure returns (bool);

    function fund() external;

    function withdraw(address _beneficiary) external;

    function close() external;

    function redeem(uint256 _amount) external;

    function repay(address _sender, uint256 _amount) external;

    function repaid() external view returns (uint256);

    function balance() external view returns (uint256);
}
