// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "./ValTokenWithHook.sol";
import "./ValSafeMath.sol";
import { StakingAsset } from "./StakingAsset.sol";

/**
 * @title Abstract StakedToken
 * @dev Single token staking model for ERC-20
 * StakedToken represents a share in an Assurace Pool.
 * Accounts stake ERC-20 staking asset and recieve ERC-20 reward asset.
 * StakingOpportunityFactory creates instances of StakedToken
 */
abstract contract AStakedToken is ValTokenWithHook {
    using ValSafeMath for uint256;

    // current representation of rewards per stake
    // this number only goes up
    uint256 cumulativeRewardsPerStake;

    // amount each account has claimed up to cumulativeRewardsPerStake
    // claiming rewards sets claimedRewardsPerStake to cumulativeRewardsPerStake
    mapping (address => uint256) claimedRewardsPerStake;

    // amount that has been awarded to the pool but not pool holders
    // tracks leftovers for when stake gets very large
    // strictly less than total supply, usually ever less than $1
    // rolls over the next time we award
    uint256 rewardsRemainder;

    // total value of stake not currently in supply and not currrently withdrawn
    // need this to calculate how many new staked tokens to awarn when depositing
    uint256 public stakePendingWithdrawal;

    // map accounts => timestamp => money
    // have to reference timestamp to access previous withdrawal
    // multiple withdrawals in the same block increase amount for that timestamp
    // same acconut that initiates withdrawal needs to complete withdrawal
    mapping (address => mapping (uint256 => uint256)) pendingWithdrawals;

    // unstake period in days
    uint256 constant UNSTAKE_PERIOD = 14 days;

    // PendingWithdrawal event is initiated when finalizing stake
    // used to help user interfaces
    event PendingWithdrawal(address indexed staker, uint256 indexed timestamp, uint256 indexed amount);

    /**
     * @dev Get unclaimed reward balance for staker
     * @param _staker address of staker
     * @return unclaimedRewards_ withdrawable amount of rewards belonging to this staker
    **/
    function unclaimedRewards(address _staker) public view returns (uint256 unclaimedRewards_) {
        uint256 stake = balanceOf[_staker];
        if (stake == 0) {
            return 0;
        }
        unclaimedRewards_ = stake.mul(cumulativeRewardsPerStake.sub(claimedRewardsPerStake[_staker], "underflow"), "unclaimed rewards overflow");
    }

    /// @return ERC-20 stake asset
    function stakeAsset() public view virtual returns (StakingAsset);

    /// @return ERC-20 reward asset
    function rewardAsset() public view virtual returns (StakingAsset);

    /// @return liquidator address
    function liquidator() public view virtual returns (address);

    // max int size to prevent overflow
    uint256 constant MAX_UINT256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    // default ratio is how much we multiply trusttokens by to calculate stake
    // helps achieve precision when dividing
    uint256 constant DEFAULT_RATIO = 1000;

    /**
     * @dev Initialize function called by constructor
     * Approves liqudiator for maximum amount
    */
    function initialize() internal {
        stakeAsset().approve(liquidator(), MAX_UINT256);
    }

    /**
     * @dev Overrides from ValTokenWithHook to track rewards remainder
     * If account is zero, we consider this value for gas refund
     * When you transfer your stake you transfer your unclaimed rewards
     * Contracts that have this staking token don't know they have rewards
     * This way we an exchange on uniswap or other exchanges
     */
    function _transferAllArgs(address _from, address _to, uint256 _value) internal override resolveSender(_from) {
        uint256 fromRewards = claimedRewardsPerStake[_from];
        if (_subBalance(_from, _value) == 0) {
            claimedRewardsPerStake[_from] = 0;
        }
        emit Transfer(_from, _to, _value);
        (address to, bool hasHook) = _resolveRecipient(_to);
        if (_to != to) {
            emit Transfer(_to, to, _value);
        }
        // here we track rewards remainder and claimed rewards per stake
        // claimed rewards per stake of _to is the weighted average of the
        // prior value and added value according to their unclaimedrewards
        uint256 priorBalance = _addBalance(to, _value);
        uint256 numerator = (_value * fromRewards + priorBalance * claimedRewardsPerStake[to]);
        uint256 denominator = (_value + priorBalance);
        uint256 result = numerator / denominator;
        uint256 remainder = numerator % denominator;
        if (remainder > 0) {
            // remainder always less than denominator
            rewardsRemainder = rewardsRemainder.add(denominator - remainder, "remainder overflow");
            result += 1;
        }
        claimedRewardsPerStake[to] = result;
        if (hasHook) {
            TrueCoinReceiver(to).tokenFallback(_from, _value);
        }
    }

    /**
     * @dev Overrides from ValTokenWithHook
     * At award time, award is not distributed to pending withdrawals
     * At deposit time, pending withdrawals are remembered to calculate stake per deposit
     * At slash time, pending withdrawals are slashed
     * So, pending withdrawals are quantified in stake
     * Pending withdrawals reduce both
     * Only KYC approved accounts can claim rewards
     * Called by initUnstake to burn and modify total supply
     * We use totalSupply to calculate rewards
     */
    function _burn(address _from, uint256 _value) internal override returns (uint256 resultBalance_, uint256 resultSupply_) {
        (resultBalance_, resultSupply_) = super._burn(_from, _value);
        uint256 userClaimedRewardsPerStake = claimedRewardsPerStake[_from];
        uint256 totalRewardsPerStake = cumulativeRewardsPerStake;
        uint256 pendingRewards = (totalRewardsPerStake - userClaimedRewardsPerStake) * _value;
        if (resultBalance_ == 0) {
            // pay out the unclaimed rewards to the pool
            _award(pendingRewards);
        } else {
            // merge unclaimed rewards with remaining balance
            // in the case this goes negative, award remainder to pool
            uint256 pendingRewardsPerStake = pendingRewards / resultBalance_;
            uint256 award_ = pendingRewards % resultBalance_;
            if (pendingRewardsPerStake > userClaimedRewardsPerStake) {
                claimedRewardsPerStake[_from] = 0;
                _award(award_.add((pendingRewardsPerStake - userClaimedRewardsPerStake).mul(resultBalance_, "award overflow"), "award overflow?"));
            } else {
                claimedRewardsPerStake[_from] = userClaimedRewardsPerStake - pendingRewardsPerStake;
                _award(award_);
            }
        }
    }

    /**
     * @dev Overrides from ValTokenWithHook
     * Checks rewards remainder of recipient of mint
     */
    function _mint(address _to, uint256 _value) internal override {
        emit Transfer(address(0), _to, _value);
        emit Mint(_to, _value);
        (address to, bool hook) = _resolveRecipient(_to);
        if (_to != to) {
            emit Transfer(_to, to, _value);
        }
        uint256 priorBalance = _addBalance(to, _value);
        uint256 numerator = (cumulativeRewardsPerStake * _value + claimedRewardsPerStake[_to] * priorBalance);
        uint256 denominator = (priorBalance + _value);
        uint256 result = numerator / denominator;
        uint256 remainder = numerator % denominator;
        if (remainder > 0) {
            rewardsRemainder = rewardsRemainder.add(denominator - remainder, "remainder overflow");
            result += 1;
        }
        claimedRewardsPerStake[_to] = result;
        totalSupply = totalSupply.add(_value, "totalSupply overflow");
        if (hook) {
            TrueCoinReceiver(to).tokenFallback(address(0x0), _value);
        }
    }

    /**
     * Called when this contract recieves stake. Called by token fallback.
     * Issue stake to _staker according to _amount
     * Invoked after _amount is deposited in this contract
    */
    function _deposit(address _staker, uint256 _amount) internal {
        uint256 balance = stakeAsset().balanceOf(address(this));
        uint256 stakeAmount;
        if (_amount < balance) {
            stakeAmount = _amount.mul(totalSupply.add(stakePendingWithdrawal, "stakePendingWithdrawal > totalSupply"), "overflow").div(balance - _amount, "insufficient deposit");
        } else {
            // first staker
            require(totalSupply == 0, "pool drained");
            stakeAmount = _amount * DEFAULT_RATIO;
        }
        _mint(_staker, stakeAmount);
    }

    /**
     * @dev If is reward asset, reward pool.
     * If stake asset, deposit.
     * Single staking token model. Can't stake TUSD for TUSD.
     */
    function tokenFallback(address _originalSender, uint256 _amount) external {
        if (msg.sender == address(stakeAsset())) {
            if (_originalSender == liquidator()) {
                // do not credit the liquidator
                return;
            }
            _deposit(_originalSender, _amount);
        } else if (msg.sender == address(rewardAsset())) {
            _award(_amount);
        } else {
            revert("Wrong token");
        }
    }

    /**
     * @dev Deposit stake into the pool.
     * @param _amount amount to deposit.
     */
    function deposit(uint256 _amount) external {
        require(stakeAsset().transferFrom(msg.sender, address(this), _amount));
    }

    /**
     * @dev Initialize unstake. Can specify a portion of your balance to unstake.
     * @param _maxAmount max amount caller wishes to unstake (in this.balanceOf units)
     * @return unstake_
    */
    function initUnstake(uint256 _maxAmount) external returns (uint256 unstake_) {
        unstake_ = balanceOf[msg.sender];
        if (unstake_ > _maxAmount) {
            unstake_ = _maxAmount;
        }
        _burn(msg.sender, unstake_); // burn tokens

        // add to stake pending withdrawals and account pending withdrawals
        stakePendingWithdrawal = stakePendingWithdrawal.add(unstake_, "stakePendingWithdrawal overflow");
        pendingWithdrawals[msg.sender][now] = pendingWithdrawals[msg.sender][now].add(unstake_, "pendingWithdrawals overflow");
        emit PendingWithdrawal(msg.sender, now, unstake_);
    }

    /**
     * @dev Finalize unstake after 2 weeks.
     * Loop over timestamps
     * Checks if unstake perioud has passed, if yes, calculate how much stake account get
     * @param recipient recipient of
     * @param _timestamps timestamps to
     */
    function finalizeUnstake(address recipient, uint256[] calldata _timestamps) external {
        uint256 totalUnstake = 0;
        // loop through timestamps and calculate total unstake
        for (uint256 i = _timestamps.length; i --> 0;) {
            uint256 timestamp = _timestamps[i];
            require(timestamp + UNSTAKE_PERIOD <= now, "must wait 2 weeks to unstake");
            // add to total unstake amount
            totalUnstake = totalUnstake.add(pendingWithdrawals[msg.sender][timestamp], "stake overflow");

            pendingWithdrawals[msg.sender][timestamp] = 0;
        }
        IERC20 stake = stakeAsset(); // get stake asset
        uint256 totalStake = stake.balanceOf(address(this)); // get total stake

        // calulate correstponding stake
        // consider stake pending withdrawal and total supply of stake token
        // totalUnstake / totalSupply = correspondingStake / totalStake
        // totalUnstake * totalStake / totalSupply = correspondingStake
        uint256 correspondingStake = totalStake.mul(totalUnstake, "totalStake*totalUnstake overflow").div(totalSupply.add(stakePendingWithdrawal, "overflow totalSupply+stakePendingWithdrawal"), "zero totals");
        stakePendingWithdrawal = stakePendingWithdrawal.sub(totalUnstake, "stakePendingWithdrawal underflow");
        stake.transfer(recipient, correspondingStake);
    }

    /**
     * @dev Transfer awards to the staking pool
     * @param _amount of rewardAsset to award
     */
    function award(uint256 _amount) external {
        require(rewardAsset().transferFrom(msg.sender, address(this), _amount));
    }

    /**
     * @dev Award stakig pool.
     * @param _amount amount of rewardAsset to reward
     */
    function _award(uint256 _amount) internal {
        uint256 remainder = rewardsRemainder.add(_amount, "rewards overflow");
        uint256 totalStake = totalSupply;
        if (totalStake > 0) {
            uint256 rewardsAdded = remainder / totalStake;
            rewardsRemainder = remainder % totalStake;
            cumulativeRewardsPerStake = cumulativeRewardsPerStake.add(rewardsAdded, "cumulative rewards overflow");
        } else {
            rewardsRemainder = remainder;
        }
    }

    /**
     * @dev Claim rewards and send to a destination.
     * @param _destination withdraw destination
     */
    function claimRewards(address _destination) external {
        // calculate how much stake and rewards account has
        uint256 stake = balanceOf[msg.sender];
        if (stake == 0) {
            return;
        }
        uint256 dueRewards = stake.mul(cumulativeRewardsPerStake.sub(claimedRewardsPerStake[msg.sender], "underflow"), "dueRewards overflow");
        if (dueRewards == 0) {
            return;
        }
        claimedRewardsPerStake[msg.sender] = cumulativeRewardsPerStake;

        // decimals are 3 more than stake asset decimals
        require(rewardAsset().transfer(_destination, dueRewards));
    }

    function decimals() public view returns (uint8) {
        return stakeAsset().decimals() + 3;
    }

    function name() public view returns (string memory) {
        return string(abi.encodePacked(stakeAsset().name(), " staked for ", rewardAsset().name()));
    }

    function symbol() public view returns (string memory) {
        return string(abi.encodePacked(stakeAsset().symbol(), ":", rewardAsset().symbol()));
    }
}
