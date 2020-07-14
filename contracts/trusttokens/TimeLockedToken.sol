// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./ValTokenWithHook.sol";
import "./ClaimableContract.sol";

/**
 * @title TimeLockedToken
 * @notice Time Locked ERC20 Token
 * @author Harold Hyatt
 * @dev Contract which gives the ability to time-lock tokens
 *
 * The registerLockup() function allows an account to transfer
 * its tokens to another account, locking them according to the
 * distribution epoch periods
 *
 * By overriding the balanceOf(), transfer(), and transferFrom()
 * functions in ERC20, an account can show its full, post-distribution
 * balance but only transfer or spend up to an allowed amount
 *
 * Every time an epoch passes, a portion of previously non-spendable tokens
 * are allowed to be transferred, and after all epochs have passed, the full
 * account balance is unlocked
 */
abstract contract TimeLockedToken is ValTokenWithHook, ClaimableContract {
    using SafeMath for uint256;

    // represents total distribution for locked balances
    mapping(address => uint256) distribution;

    // start of the lockup period
    uint256 constant LOCK_START = 1594716039;
    // how much longer is the first epoch
    uint256 constant FIRST_EPOCH_DELAY = 30 days;
    // how long does an epoch last
    uint256 constant EPOCH_DURATION = 90 days;
    // number of epochs
    uint256 constant TOTAL_EPOCHS = 8;
    // registry of locked addresses
    address public timeLockRegistry;

    modifier onlyTimeLockRegistry() {
        require(msg.sender == timeLockRegistry, "only TimeLockRegistry");
        _;
    }

    /**
     * @dev set TimeLockRegistry address
     */
    function setTimeLockRegistry(address newTimeLockRegistry) external onlyOwner {
        timeLockRegistry = newTimeLockRegistry;
    }

    /**
     * @dev transfer function which includes unlocked tokens
     */
    function _transferAllArgs(
        address _from,
        address _to,
        uint256 _value
    ) internal override resolveSender(_from) {
        require(balanceOf[_from] >= _value, "insufficient balance");
        require(unlockedBalance(_from) >= _value, "attempting to transfer locked funds");

        super._transferAllArgs(_from, _to, _value);
    }

    /**
     * @dev transferFrom function which includes unlocked tokens
     */
    function _transferFromAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal override {
        require(balanceOf[_from] >= _value, "insufficient balance");
        require(unlockedBalance(_from) >= _value, "attempting to transfer locked funds");

        super._transferFromAllArgs(_from, _to, _value, _spender);
    }

    /**
     * @dev Transfer tokens to another account under the lockup schedule
     * Emits a transfer event showing a transfer to the recipient
     */
    function registerLockup(address recipient, uint256 amount) external onlyTimeLockRegistry {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        require(distribution[recipient] == 0, "distribution already set");

        // set distribution to lockup amount
        distribution[recipient] = amount;

        // transfer to recipient
        _transferAllArgs(msg.sender, recipient, amount);

        // show transfer from sender to recipient
        emit Transfer(msg.sender, recipient, amount);
    }

    /**
     * @dev Get locked balance for an account
     */
    function lockedBalance(address account) public view returns (uint256) {
        // distribution * (epochsLeft / totalEpochs)
        uint256 epochsLeft = TOTAL_EPOCHS.sub(epochsPassed());
        return distribution[account].mul(epochsLeft).div(TOTAL_EPOCHS);
    }

    /**
     * @dev Get unlocked balance for an account
     */
    function unlockedBalance(address account) public view returns (uint256) {
        // totalBalance - lockedBalance
        return balanceOf[account].sub(lockedBalance(account));
    }

    /*
     * @dev get number of epochs passed
     */
    function epochsPassed() public view returns (uint256) {
        uint256 timePassed = block.timestamp.sub(LOCK_START);
        if (timePassed < FIRST_EPOCH_DELAY) {
            return 0;
        }
        uint256 totalEpochsPassed = timePassed.sub(FIRST_EPOCH_DELAY).div(EPOCH_DURATION);
        if (totalEpochsPassed > TOTAL_EPOCHS) {
            return TOTAL_EPOCHS;
        }
        return totalEpochsPassed;
    }

    /**
     * @dev Get timestamp of next epoch
     */
    function nextEpoch() public view returns (uint256) {
        if (epochsPassed() == 0) {
            return latestEpoch().add(FIRST_EPOCH_DELAY).add(EPOCH_DURATION);
        }
        return latestEpoch().add(EPOCH_DURATION);
    }

    /**
     * @dev Get timestamp of last epoch
     */
    function latestEpoch() public view returns (uint256) {
        // lockStart + epochsPassed * epochSize
        if (epochsPassed() == 0) {
            return LOCK_START;
        }
        return LOCK_START.add(FIRST_EPOCH_DELAY).add(epochsPassed().mul(EPOCH_DURATION));
    }

    /**
     * @dev Get timestamp of final epoch
     */
    function finalEpoch() public pure returns (uint256) {
        // lockStart + epochSize * totalEpochs
        return LOCK_START + FIRST_EPOCH_DELAY + (EPOCH_DURATION * TOTAL_EPOCHS);
    }

    /**
     * @dev Get timestamp of locking period start
     */
    function lockStart() public pure returns (uint256) {
        return LOCK_START;
    }
}
