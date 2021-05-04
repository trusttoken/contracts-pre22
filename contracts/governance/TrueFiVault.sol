// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StkTruToken} from "./StkTruToken.sol";

/**
 * @title TrueFiVault
 * @dev Vault for granting TRU tokens from owner to beneficiary after a lockout period.
 *
 * After the lockout period, beneficiary may withdraw any TRU in the vault.
 * During the lockout period, the vault still allows beneficiary to stake TRU
 * and cast votes in governance.
 *
 * In case of emergency or error, owner reserves the ability to withdraw all
 * funds in vault.
 */
contract TrueFiVault {
    using SafeMath for uint256;

    address public owner;
    address public beneficiary;
    uint256 public expiry;
    IERC20 public tru;
    StkTruToken public stkTru;

    event WithdrawTo(address recipient);

    constructor(
        address _beneficiary,
        uint256 _amount,
        uint256 _duration,
        IERC20 _tru,
        StkTruToken _stkTru
    ) public {
        owner = msg.sender;
        beneficiary = _beneficiary;
        expiry = block.timestamp.add(_duration);
        tru = _tru;
        stkTru = _stkTru;

        require(tru.transferFrom(owner, address(this), _amount), "TrueFiVault: insufficient owner balance");
        stkTru.delegate(beneficiary);
    }

    /**
     * @dev Throws if called by any account other than the beneficiary.
     */
    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "TrueFiVault: only beneficiary");
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "TrueFiVault: only owner");
        _;
    }

    /**
     * @dev Allow owner to withdraw funds in case of emergency or mistake
     */
    function withdrawToOwner() external onlyOwner {
        beneficiary = owner;
        _withdrawToBeneficiary();
    }

    /**
     * @dev Withdraw funds to beneficiary after expiry time
     */
    function withdrawToBeneficiary() external onlyBeneficiary {
        require(block.timestamp >= expiry, "TrueFiVault: beneficiary cannot withdraw before expiration");
        _withdrawToBeneficiary();
    }

    /**
     * @dev Internal function to withdraw funds to beneficiary
     */
    function _withdrawToBeneficiary() private {
        emit WithdrawTo(beneficiary);
        claimRewards();
        require(tru.transfer(beneficiary, tru.balanceOf(address(this))), "TrueFiVault: insufficient TRU balance");
        require(stkTru.transfer(beneficiary, stkTru.balanceOf(address(this))), "TrueFiVault: insufficient stkTRU balance");
    }

    /**
     * @dev Stake `amount` TRU in staking contract
     * @param amount Amount of TRU to stake
     */
    function stake(uint256 amount) external onlyBeneficiary {
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
}
