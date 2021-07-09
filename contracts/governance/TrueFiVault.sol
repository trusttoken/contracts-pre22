// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVoteTokenWithERC20} from "./interface/IVoteToken.sol";
import {IStkTruToken} from "./interface/IStkTruToken.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

/**
 * @title TrueFiVault
 * @dev Vault for granting TRU tokens from owner to beneficiary after a lockout period.
 *
 * After the lockout period, beneficiary may withdraw any TRU in the vault.
 * During the lockout period, the vault still allows beneficiary to stake TRU
 * and cast votes in governance.
 *
 */
contract TrueFiVault is UpgradeableClaimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using SafeERC20 for IVoteTokenWithERC20;

    uint256 public constant DURATION = 365 days;

    address public beneficiary;
    uint256 public expiry;
    uint256 public withdrawn;

    IVoteTokenWithERC20 public tru;
    IStkTruToken public stkTru;

    function withdrawToOwner() external {
        tru.safeTransfer(owner(), tru.balanceOf(address(this)));
    }
}
