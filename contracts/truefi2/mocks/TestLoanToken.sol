// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "../../common/UpgradeableERC20.sol";

// This contract mimics loan token with different initialize signature
contract TestLoanToken is ERC20 {
    function initialize(address _borrower) external initializer {}
}
