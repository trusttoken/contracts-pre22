// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILoanToken is IERC20 {
    function isLoanToken() external pure returns (bool);

    function fund() external;

    function withdraw(address _beneficiary, uint256 _amount) external;

    function close() external;

    function redeem(uint256 _amount) external;

    function settled() external view returns (bool);

    function balance() external view returns (uint256);
}
