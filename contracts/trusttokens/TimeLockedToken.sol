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
 * distribution epoch periods.
 *
 * By overriding the balanceOf(), transfer(), and transferFrom()
 * functions in ERC20, an account can show its full, post-distribution
 * balance but only trasnfer or spend up to an allowed amount
 * 
 * initalizeLockup() sets a lockStart, epochSize, and totalEpochs which
 * are used to calculate when an account can spend locked tokens. Only the
 * contract owner can call the initalize function, and the initalize function
 * can only be called once
 *
 * Every time an epoch passes, a portion of previously non-spendable tokens
 * are allowed to be transferred, and after all epochs have passed, the full
 * account balance is unlocked.
 */
contract TimeLockedToken is ValTokenWithHook, ClaimableContract {
    // represents total distribution for locked balances
    mapping(address => uint256) public distribution;

    // variables relating to lockup epochs
    uint256 public lockStart;
    uint256 public epochSize;
    uint256 public totalEpochs;

    bool public lockupInitalized;

    using SafeMath for uint256;

    /**
     * @dev initalize lockup variables
     */
    function initalizeLockup() public onlyOwner {
        require(!lockupInitalized, "lockup already initalized");
        // start lockup at initalize time
        lockStart = block.timestamp;
        // 4 epochs per year
        epochSize = (365 days).div(4);
        // total lockup of 2 years with 8 epochs
        totalEpochs = 8;
        // set initalized variable
        lockupInitalized = false;
    }

    /**
     * @dev get balance for an account including locked tokens
     */
    function balanceOf(address _who) public virtual view returns (uint256) {
        return super.balanceOf(_who).add(distribution[_who]);
    }

    /**
     * @dev transfer function which includes unlocked tokens
     */
    function _transferAllArgs(
        address _from,
        address _to,
        uint256 _value
    ) internal virtual resolveSender(_from) {
        // for accounts with no lockup, call super
        if (distribution[msg.sender] == 0) {
            super._transferAllArgs(_from, _to, _value);
        }
        else {
            // TODO: custom transfer logic for lockup
            // emit Transfer(msg.sender, recipient, amount);
        }
    }

    /**
     * @dev transferFrom function which includes unlocked tokens
     */
    function _transferFromAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal {
        // for accounts with no lockup, call super
        if (distribution[msg.sender] == 0) {
            super._transferFromAllArgs(_from, _to, _value, _spender);
        }
        else {
            // TODO: custom transfer logic for lockup
            // emit Transfer(msg.sender, recipient, amount);
        }
    }

    /**
     * @dev Transfer tokens to another account under the lockup schedule
     * Emits a transfer event showing a transfer to the recipient
     */
    function registerLockup(address recipient, uint256 amount) public {
        require(balanceOf[msg.sender].sub(amount) > 0, "insufficient balance");

        // subtract balance from sender
        balanceOf[msg.sender] = balanceOf[msg.sender].sub(amount);

        // set distribution to lockup amount
        distribution[recipient] = amount;

        // show transfer from sender to recipient
        emit Transfer(msg.sender, amount);
    }

    /**
     * @dev Get locked balance for an account
     */
    function lockedBalance(address account) public view returns (uint256) {
        // distribution - unlockedBalance
        return distribution[account].sub(unlockedBalance(account));
    }

    /**
     * @dev Get unlocked balance for an account
     */
    function unlockedBalance(address account) public returns (uint256) {
        // distribution / totalEpochs * epochsPassed
        return distribution[account].div(totalEpochs).mul(epochsPassed());
    }

    /*
     * @dev get number of epochs passed
     */
    function epochsPassed() public returns (uint256) {
        if (lastEpoch() <= finalEpoch()) {
            return totalEpochs;
        }
        // calculate using integer division to round down
        return block.timestamp.sub(lockStart) / epochSize;
    }

    /**
    * @dev Get timestamp of next epoch
    */
    function nextEpoch() public view returns (uint256) {
        return lastEpoch().add(epochSize).sub(block.timestamp);
    }

    /**
    * @dev Get timestamp of last epoch
    */
    function lastEpoch() public view returns (uint256) {
        // lockStart + epochsPassed * epochSize
        return lockStart.add(epochsPassed().mul(epochSize));
    }

    /**
     * @dev Get timestamp of final epoch
     */
    function finalEpoch() public view returns (uint256) {
        // lockStart + epochSize * totalEpochs
        return lockStart.add(epochSize.mul(totalEpochs));
    }
}