// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";
import {IDebtToken} from "./interface/IDebtToken.sol";
import {IDeficiencyToken} from "./interface/IDeficiencyToken.sol";

/**
 *
 */
contract DeficiencyToken is IDeficiencyToken, ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    IDebtToken public override debt;

    /**
     * @dev Create Deficiency
     * @param _debt Defaulted debts address
     * @param _amount Amount of underlying pool token's that are owed to the pool
     */
    constructor(IDebtToken _debt, uint256 _amount) public {
        ERC20.__ERC20_initialize("TrueFi Deficiency Token", "DEF");

        debt = _debt;
        _mint(address(_debt.pool()), _amount);
    }

    function burnFrom(address account, uint256 amount) external override {
        _approve(
            account,
            _msgSender(),
            allowance(account, _msgSender()).sub(amount, "DeficiencyToken: Burn amount exceeds allowance")
        );
        _burn(account, amount);
    }

    function version() external override pure returns (uint8) {
        return 0;
    }
}
