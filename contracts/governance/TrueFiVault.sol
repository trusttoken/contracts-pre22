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

    event Withdraw(IERC20 token, uint256 amount, address beneficiary);

    function initialize(
        address _beneficiary,
        uint256 _amount,
        IVoteTokenWithERC20 _tru,
        IStkTruToken _stkTru
    ) external initializer {
        UpgradeableClaimable.initialize(msg.sender);

        beneficiary = _beneficiary;
        expiry = block.timestamp.add(DURATION);
        tru = _tru;
        stkTru = _stkTru;

        // TODO Uncomment after TRU is updated to support voting
        //        tru.delegate(beneficiary);
        stkTru.delegate(beneficiary);

        // transfer from sender
        tru.safeTransferFrom(msg.sender, address(this), _amount);
    }

    /**
     * @dev Throws if called by any account other than the beneficiary.
     */
    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "TrueFiVault: only beneficiary");
        _;
    }

    function withdrawable(IERC20 token) public view returns (uint256) {
        uint256 tokenBalance = token.balanceOf(address(this));
        uint256 timePassed = block.timestamp.sub(expiry.sub(DURATION));
        if (timePassed > DURATION) {
            timePassed = DURATION;
        }
        uint256 amount = totalBalance().add(withdrawn).mul(timePassed).div(DURATION).sub(withdrawn);
        if (token == stkTru) {
            amount = amount.mul(stkTru.totalSupply()).div(stkTru.stakeSupply());
        }
        return amount > tokenBalance ? tokenBalance : amount;
    }

    /**
     * @dev Withdraw vested TRU to beneficiary
     */
    function withdrawTru(uint256 amount) external onlyBeneficiary {
        claimRewards();
        require(amount <= withdrawable(tru), "TrueFiVault: attempting to withdraw more than allowed");
        withdrawn = withdrawn.add(amount);
        _withdraw(tru, amount);
    }

    /**
     * @dev Withdraw vested stkTRU to beneficiary
     */
    function withdrawStkTru(uint256 amount) external onlyBeneficiary {
        require(amount <= withdrawable(stkTru), "TrueFiVault: attempting to withdraw more than allowed");
        withdrawn = withdrawn.add(amount.mul(stkTru.stakeSupply()).div(stkTru.totalSupply()));
        _withdraw(stkTru, amount);
    }

    /**
     * @dev Withdraw all funds to beneficiary after expiry time
     */
    function withdrawToBeneficiary() external onlyBeneficiary {
        uint256 timePassed = block.timestamp.sub(expiry.sub(DURATION));
        require(timePassed >= DURATION, "TrueFiVault: vault is not expired yet");
        claimRewards();
        _withdraw(tru, tru.balanceOf(address(this)));
        _withdraw(stkTru, stkTru.balanceOf(address(this)));
    }

    function _withdraw(IERC20 token, uint256 amount) private {
        token.safeTransfer(beneficiary, amount);
        emit Withdraw(token, amount, beneficiary);
    }

    /**
     * @dev Stake `amount` TRU in staking contract
     * @param amount Amount of TRU to stake
     */
    function stake(uint256 amount) external onlyBeneficiary {
        tru.safeApprove(address(stkTru), amount);
        stkTru.stake(amount);
    }

    /**
     * @dev unstake `amount` TRU in staking contract
     * @param amount Amount of TRU to unstake
     */
    function unstake(uint256 amount) external onlyBeneficiary {
        stkTru.unstake(amount);
    }

    /**
     * @dev Initiate cooldown for staked TRU
     */
    function cooldown() external onlyBeneficiary {
        stkTru.cooldown();
    }

    /**
     * @dev Claim TRU rewards from staking contract
     */
    function claimRewards() public onlyBeneficiary {
        stkTru.claimRewards(tru);
    }

    /**
     * @dev Claim TRU rewards, then restake without transferring
     * Allows account to save more gas by avoiding out-and-back transfers
     */
    function claimRestake() external onlyBeneficiary {
        stkTru.claimRestake(0);
    }

    /**
     * @dev Delegate tru+stkTRU voting power to another address
     * @param delegatee Address to delegate to
     */
    function delegate(address delegatee) external onlyBeneficiary {
        tru.delegate(delegatee);
        stkTru.delegate(delegatee);
    }

    /**
     * @dev Claim rewards in tfTUSD and feeToken from stake and transfer to the beneficiary
     */
    function claimFeeRewards() external onlyBeneficiary {
        stkTru.claim();
        IERC20 tfTUSD = stkTru.tfusd();
        tfTUSD.safeTransfer(beneficiary, tfTUSD.balanceOf(address(this)));
        IERC20 feeToken = stkTru.feeToken();
        feeToken.safeTransfer(beneficiary, feeToken.balanceOf(address(this)));
    }

    function totalBalance() public view returns (uint256) {
        uint256 normalizedStkTruBalance = stkTru.balanceOf(address(this)).mul(stkTru.stakeSupply()).div(stkTru.totalSupply());
        return tru.balanceOf(address(this)).add(normalizedStkTruBalance);
    }
}
