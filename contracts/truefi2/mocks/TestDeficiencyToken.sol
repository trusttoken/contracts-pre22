// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {DeficiencyToken} from "../DeficiencyToken.sol";
import {ERC20} from "../../common/UpgradeableERC20.sol";
import {ILoanToken2} from "../interface/ILoanToken2.sol";

/**
 * @dev Helper contract to test the burning feature of DeficiencyToken
 */
contract TestDeficiencyToken is DeficiencyToken {
    constructor(ILoanToken2 _loan, uint256 _amount) public DeficiencyToken(_loan, _amount) {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
