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
     * @dev Set TimeLockRegistry address
     * @param newTimeLockRegistry Address of TimeLockRegistry contract
     */
    function setTimeLockRegistry(address newTimeLockRegistry) external onlyOwner {
        timeLockRegistry = newTimeLockRegistry;
    }

    /**
     * @dev Transfer function which includes unlocked tokens
     * @param _from The address to send tokens from
     * @param _to The address that will receive the tokens
     * @param _value The amount of tokens to be transferred
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
     * @param _from The address to send tokens from
     * @param _to The address that will receive the tokens
     * @param _value The amount of tokens to be transferred
     * @param _spender The address allowed to make the transfer
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
     * @param receiver Address to receive the tokens
     * @param amount Tokens to be transferred
     */
    function registerLockup(address receiver, uint256 amount) external onlyTimeLockRegistry {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        require(distribution[receiver] == 0, "distribution already set");

        // set distribution to lockup amount
        distribution[receiver] = amount;

        // transfer to recipient
        _transferAllArgs(msg.sender, receiver, amount);

        // show transfer from sender to recipient
        emit Transfer(msg.sender, receiver, amount);
    }

    /**
     * @dev Get locked balance for an account
     * @param account Account to check
     * @return Amount locked
     */
    function lockedBalance(address account) public view returns (uint256) {
        // distribution * (epochsLeft / totalEpochs)
        uint256 epochsLeft = TOTAL_EPOCHS.sub(epochsPassed());
        return distribution[account].mul(epochsLeft).div(TOTAL_EPOCHS);
    }

    /**
     * @dev Get unlocked balance for an account
     * @param account Account to check
     * @return Amount that is unlocked and available eg. to transfer
     */
    function unlockedBalance(address account) public view returns (uint256) {
        // totalBalance - lockedBalance
        return balanceOf[account].sub(lockedBalance(account));
    }

    /*
     * @dev Get number of epochs passed
     * @return Value between 0 and 8 of lockup epochs already passed
     */
    function epochsPassed() public view returns (uint256) {
        // how long it is since the beginning of lockup period
        uint256 timePassed = block.timestamp.sub(LOCK_START);
        // 1st epoch is FIRST_EPOCH_DELAY longer; we check to prevent subtraction underflow
        if (timePassed < FIRST_EPOCH_DELAY) {
            return 0;
        }
        // subtract the FIRST_EPOCH_DELAY, so that we can count all epochs as lasting EPOCH_DURATION
        uint256 totalEpochsPassed = timePassed.sub(FIRST_EPOCH_DELAY).div(EPOCH_DURATION);
        // epochs don't count over TOTAL_EPOCHS
        if (totalEpochsPassed > TOTAL_EPOCHS) {
            return TOTAL_EPOCHS;
        }
        return totalEpochsPassed;
    }

    /**
     * @dev Get timestamp of next epoch
     * @return Timestamp of when the next epoch starts
     */
    function nextEpoch() public view returns (uint256) {
        if (epochsPassed() == 0) {
            return latestEpoch().add(FIRST_EPOCH_DELAY).add(EPOCH_DURATION);
        }
        return latestEpoch().add(EPOCH_DURATION);
    }

    /**
     * @dev Get timestamp of latest epoch
     * @return Timestamp of when the current epoch has started
     */
    function latestEpoch() public view returns (uint256) {
        // lockStart + epochsPassed * epochDuration, and account for 1st epoch being longer
        if (epochsPassed() == 0) {
            return LOCK_START;
        }
        return LOCK_START.add(FIRST_EPOCH_DELAY).add(epochsPassed().mul(EPOCH_DURATION));
    }

    /**
     * @dev Get timestamp of final epoch
     * @return Timestamp of when the last epoch ends and all funds are released
     */
    function finalEpoch() public pure returns (uint256) {
        return LOCK_START + FIRST_EPOCH_DELAY + (EPOCH_DURATION * TOTAL_EPOCHS);
    }

    /**
     * @dev Get timestamp of locking period start
     * @return Timestamp of locking period start
     */
    function lockStart() public pure returns (uint256) {
        return LOCK_START;
    }
}
