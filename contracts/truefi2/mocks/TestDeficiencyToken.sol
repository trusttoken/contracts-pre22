// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {DeficiencyToken} from "../DeficiencyToken.sol";
import {ERC20} from "../../common/UpgradeableERC20.sol";
import {IDebtToken} from "../interface/IDebtToken.sol";

/**
 * @dev Helper contract to test the burning feature of DeficiencyToken
 */
contract TestDeficiencyToken is DeficiencyToken {
    constructor(IDebtToken _debt, uint256 _amount) public DeficiencyToken(_debt, _amount) {}

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}
