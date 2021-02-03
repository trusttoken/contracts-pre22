// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "@openzeppelin/contracts/math/SafeMath.sol";

import {VoteToken} from "../governance/VoteToken.sol";
import {ClaimableContract} from "./common/ClaimableContract.sol";

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
abstract contract TimeLockedToken is VoteToken, ClaimableContract {
    using SafeMath for uint256;

    // represents total distribution for locked balances
    mapping(address => uint256) distribution;

    // start of the lockup period
    // Friday, July 24, 2020 4:58:31 PM GMT
    uint256 constant LOCK_START = 1595609911;
    // length of time to delay first epoch
    uint256 constant FIRST_EPOCH_DELAY = 30 days;
    // how long does an epoch last
    uint256 constant EPOCH_DURATION = 90 days;
    // number of epochs
    uint256 constant TOTAL_EPOCHS = 8;
    // registry of locked addresses
    address public timeLockRegistry;
    // allow unlocked transfers to special account
    bool public returnsLocked;

    modifier onlyTimeLockRegistry() {
        require(msg.sender == timeLockRegistry, "only TimeLockRegistry");
        _;
    }

    /**
     * @dev Set TimeLockRegistry address
     * @param newTimeLockRegistry Address of TimeLockRegistry contract
     */
    function setTimeLockRegistry(address newTimeLockRegistry) external onlyOwner {
        require(newTimeLockRegistry != address(0), "cannot be zero address");
        require(newTimeLockRegistry != timeLockRegistry, "must be new TimeLockRegistry");
        timeLockRegistry = newTimeLockRegistry;
    }

    /**
     * @dev Permanently lock transfers to return address
     * Lock returns so there isn't always a way to send locked tokens
     */
    function lockReturns() external onlyOwner {
        returnsLocked = true;
    }

    /**
     * @dev Transfer function which includes unlocked tokens
     * Locked tokens can always be transfered back to the returns address
     * Transferring to owner allows re-issuance of funds through registry
     *
     * @param _from The address to send tokens from
     * @param _to The address that will receive the tokens
     * @param _value The amount of tokens to be transferred
     */
    function _transfer(
        address _from,
        address _to,
        uint256 _value
    ) internal virtual override {
        require(balanceOf[_from] >= _value, "insufficient balance");

        // transfers to owner proceed as normal when returns allowed
        if (!returnsLocked && _to == owner_) {
            transferToOwner(_from, _value);
            return;
        }
        // check if enough unlocked balance to transfer
        require(unlockedBalance(_from) >= _value, "attempting to transfer locked funds");
        super._transfer(_from, _to, _value);
    }

    /**
     * @dev Transfer tokens to owner. Used only when returns allowed.
     * @param _from The address to send tokens from
     * @param _value The amount of tokens to be transferred
     */
    function transferToOwner(address _from, uint256 _value) internal {
        uint256 unlocked = unlockedBalance(_from);

        if (unlocked < _value) {
            // We want to have unlocked = value, i.e.
            // value = balance - distribution * epochsLeft / totalEpochs
            // distribution = (balance - value) * totalEpochs / epochsLeft
            distribution[_from] = balanceOf[_from].sub(_value).mul(TOTAL_EPOCHS).div(epochsLeft());
        }
        super._transfer(_from, owner_, _value);
    }

    /**
     * @dev Check if amount we want to burn is unlocked before burning
     * @param _from The address whose tokens will burn
     * @param _value The amount of tokens to be burnt
     */
    function _burn(address _from, uint256 _value) internal override {
        require(balanceOf[_from] >= _value, "insufficient balance");
        require(unlockedBalance(_from) >= _value, "attempting to burn locked funds");

        super._burn(_from, _value);
    }

    /**
     * @dev Transfer tokens to another account under the lockup schedule
     * Emits a transfer event showing a transfer to the recipient
     * Only the registry can call this function
     * @param receiver Address to receive the tokens
     * @param amount Tokens to be transferred
     */
    function registerLockup(address receiver, uint256 amount) external onlyTimeLockRegistry {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");

        // add amount to locked distribution
        distribution[receiver] = distribution[receiver].add(amount);

        // transfer to recipient
        _transfer(msg.sender, receiver, amount);
    }

    /**
     * @dev Get locked balance for an account
     * @param account Account to check
     * @return Amount locked
     */
    function lockedBalance(address account) public view returns (uint256) {
        // distribution * (epochsLeft / totalEpochs)
        return distribution[account].mul(epochsLeft()).div(TOTAL_EPOCHS);
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

    function _balanceOf(address account) internal override view returns (uint256) {
        return unlockedBalance(account);
    }

    /*
     * @dev Get number of epochs passed
     * @return Value between 0 and 8 of lockup epochs already passed
     */
    function epochsPassed() public view returns (uint256) {
        // return 0 if timestamp is lower than start time
        if (block.timestamp < LOCK_START) {
            return 0;
        }

        // how long it has been since the beginning of lockup period
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

    function epochsLeft() public view returns (uint256) {
        return TOTAL_EPOCHS.sub(epochsPassed());
    }

    /**
     * @dev Get timestamp of next epoch
     * Will revert if all epochs have passed
     * @return Timestamp of when the next epoch starts
     */
    function nextEpoch() public view returns (uint256) {
        // get number of epochs passed
        uint256 passed = epochsPassed();

        // if all epochs passed, return
        if (passed == TOTAL_EPOCHS) {
            // return INT_MAX
            return uint256(-1);
        }

        // if no epochs passed, return latest epoch + delay + standard duration
        if (passed == 0) {
            return latestEpoch().add(FIRST_EPOCH_DELAY).add(EPOCH_DURATION);
        }

        // otherwise return latest epoch + epoch duration
        return latestEpoch().add(EPOCH_DURATION);
    }

    /**
     * @dev Get timestamp of latest epoch
     * @return Timestamp of when the current epoch has started
     */
    function latestEpoch() public view returns (uint256) {
        // get number of epochs passed
        uint256 passed = epochsPassed();

        // if no epochs passed, return lock start time
        if (passed == 0) {
            return LOCK_START;
        }

        // accounts for first epoch being longer
        // lockStart + firstEpochDelay + (epochsPassed * epochDuration)
        return LOCK_START.add(FIRST_EPOCH_DELAY).add(passed.mul(EPOCH_DURATION));
    }

    /**
     * @dev Get timestamp of final epoch
     * @return Timestamp of when the last epoch ends and all funds are released
     */
    function finalEpoch() public pure returns (uint256) {
        // lockStart + firstEpochDelay + (epochDuration * totalEpochs)
        return LOCK_START.add(FIRST_EPOCH_DELAY).add(EPOCH_DURATION.mul(TOTAL_EPOCHS));
    }

    /**
     * @dev Get timestamp of locking period start
     * @return Timestamp of locking period start
     */
    function lockStart() public pure returns (uint256) {
        return LOCK_START;
    }
}
