// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IStkTruToken} from "./interface/IStkTruToken.sol";

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

    uint256 public DURATION = 365 days;

    address public owner;
    address public beneficiary;
    uint256 public expiry;
    mapping(IERC20 => uint256) public withdrawn;

    IERC20 public tru;
    IStkTruToken public stkTru;

    event Withdraw(IERC20 token, uint256 amount, address beneficiary);

    constructor(
        address _beneficiary,
        IERC20 _tru,
        IStkTruToken _stkTru
    ) public {
        owner = msg.sender;
        beneficiary = _beneficiary;
        expiry = block.timestamp.add(DURATION);
        tru = _tru;
        stkTru = _stkTru;

        stkTru.delegate(beneficiary);
    }

    function lock(uint256 _amount) external onlyOwner {
        require(tru.balanceOf(address(this)) == 0, "TrueFiVault: funds already locked");
        require(tru.transferFrom(owner, address(this), _amount), "TrueFiVault: insufficient owner balance");
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

    function withdrawable(IERC20 token) public view returns (uint256) {
        if (beneficiary == owner) {
            return token.balanceOf(address(this));
        }
        uint256 timePassed = block.timestamp.sub(expiry.sub(DURATION));
        if (timePassed > DURATION) {
            timePassed = DURATION;
        }
        return token.balanceOf(address(this)).add(withdrawn[token]).mul(timePassed).div(DURATION).sub(withdrawn[token]);
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
        _withdrawToBeneficiary();
    }

    /**
     * @dev Internal function to withdraw funds to beneficiary
     */
    function _withdrawToBeneficiary() private {
        claimRewards();
        _withdraw(tru);
        _withdraw(stkTru);
    }

    function _withdraw(IERC20 token) private {
        uint256 amountToWithdraw = withdrawable(token);
        require(token.transfer(beneficiary, amountToWithdraw), "TrueFiVault: insufficient balance");
        withdrawn[token] = withdrawn[token].add(amountToWithdraw);

        emit Withdraw(token, amountToWithdraw, beneficiary);
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
