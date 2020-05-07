pragma solidity ^0.5.13;

import { TrueCoinReceiver } from "./TrueCoinReceiver.sol";
import { FinancialOpportunity } from "../TrueReward/FinancialOpportunity.sol";
import { RewardTokenWithReserve } from "./RewardTokenWithReserve.sol";

/**
 * @title TrueRewardBackedToken
 * @dev TrueRewardBackedToken is TrueUSD backed by debt
 *
 * -- Overview --
 * Enabling TrueRewards deposits TUSD into a financial opportunity
 * Financial opportunities provide awards over time
 * Awards are reflected in the wallet balance updated block-by-block
 *
 * -- rewardToken vs yToken --
 * rewardToken represents an amount of ASSURED TUSD owed to the rewardToken holder
 * yToken represents an amount of NON-ASSURED TUSD owed to a fToken holder
 * For this contract, we only handle rewardToken (Assured Opportunities)
 *
 * -- Calculating rewardToken --
 * TUSD Value = rewardToken * financial opportunity tokenValue()
 *
 * -- rewardToken Assumptions --
 * We assume tokenValue never decreases for assured financial opportunities
 * rewardToken is not transferrable in that the token itself is never tranferred
 * Rather, we override our transfer functions to account for user balances
 *
 * -- Reserve --
 * This contract uses a reserve holding of TUSD and rewardToken to save on gas costs
 * because calling the financial opportunity deposit() and redeem() everytime
 * can be expensive
 * See RewardTokenWithReserve.sol
 *
 * -- Future Upgrades to Financial Opportunity --
 * Currently, we only have a single financial opportunity
 * We plan on upgrading this contract to support a multiple financial opportunity,
 * so some of the code is built to support this
 *
 */
contract TrueRewardBackedToken is RewardTokenWithReserve {

    /* variables in Proxy Storage:
    mapping(address => FinancialOpportunity) finOps;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;
    uint256 maxRewardProportion = 1000;
    */
    
    // registry attribute for whitelist
    // 0x6973547275655265776172647357686974656c69737465640000000000000000
    bytes32 constant IS_TRUEREWARDS_WHITELISTED = "isTrueRewardsWhitelisted";

    // financial opportunity address
    address public opportunity_;

    event TrueRewardEnabled(address _account);
    event TrueRewardDisabled(address _account);

    /** @dev return true if TrueReward is enabled for a given address */
    function trueRewardEnabled(address _address) public view returns (bool) {
        return _rewardDistribution[_address].length != 0;
    }

    /*
     * @dev calculate rewards earned since last deposit
     * todo feewet fix this function, can we actually calc this??
     */
    function rewardsAccrued(address account, address finOp) public view returns (uint) {
        uint rewardBalance = rewardTokenBalance(account, opportunity());
        return _toToken(rewardBalance, finOp) - _toToken(rewardBalance, finOp);
    }

    /**
     * @dev Get total supply of all TUSD backed by debt.
     * This amount includes accrued rewards.
     * Currently works for a single finOp
     *
     * @return total supply in trueCurrency
     */
    function totalSupply() public view returns (uint256) {
        // if supply in opportunity finOp, return value including finOp value
        // otherwise call super to return normal totalSupply
        if (opportunitySupply() != 0) {
            // calculate depositToken value of finOp total supply
            uint depositValue = _toToken(opportunitySupply(), opportunity());

            // return token total supply plus deposit token value
            return totalSupply_.add(depositValue);
        }
        return super.totalSupply();
    }

    /**
     * @dev Get balance of TUSD including rewards for an address
     *
     * @param _who address of account to get balanceOf for
     * @return balance total balance of address including rewards
     */
    function balanceOf(address _who) public view returns (uint256) {
        // if trueReward enabled, return token value of reward balance
        // otherwise call token balanceOf
        if (trueRewardEnabled(_who)) {
            return _toToken(rewardTokenBalance(_who, opportunity()), opportunity());
        }
        return super.balanceOf(_who);
    }

    /**
     * @dev Enable TrueReward and deposit user balance into opportunity.
     * Currently supports a single financial opportunity
     */
    function enableTrueReward() external {
        // require TrueReward is not enabled
        require(registry.hasAttribute(msg.sender, IS_TRUEREWARDS_WHITELISTED),
            "must be whitelisted to enable TrueRewards");
        require(!trueRewardEnabled(msg.sender), "TrueReward already enabled");

        // get sender balance
        uint balance = _getBalance(msg.sender);

        if (balance != 0) {
            // mint reward token
            mintRewardToken(msg.sender, balance, opportunity());
        }

        // set reward distribution
        // we set max distribution since we only have one opportunity
        _setDistribution(maxRewardProportion, opportunity());

        // emit enable event
        emit TrueRewardEnabled(msg.sender);
        //emit Transfer(address(0), msg.sender, balance);
    }

    /**
     * @dev Disable TrueReward and withdraw user balance from opportunity.
     */
    function disableTrueReward() external {
        // require TrueReward is enabled
        require(trueRewardEnabled(msg.sender), "TrueReward already disabled");
        // get balance
        uint rewardBalance = rewardTokenBalance(msg.sender, opportunity());

        // remove reward distribution
        _removeDistribution(opportunity());

        // redeem for token
        redeemRewardToken(msg.sender, rewardBalance, opportunity());

        // emit disable event
        emit TrueRewardDisabled(msg.sender);
        // emit Transfer(msg.sender, address(0), ztusd);
    }

    /**
     * @dev mint function for TrueRewardBackedToken
     * Mints TrueUSD backed by debt
     * When we add multiple opportunities, this needs to work for mutliple interfaces
     */
    function mint(address _to, uint256 _value) public onlyOwner {
        super.mint(_to, _value);
        bool toEnabled = trueRewardEnabled(_to);
        if (toEnabled) {
            mintRewardToken(_to, _value, opportunity());
            emit Transfer(address(0), _to, _value);
        }
    }

    /**
     * @dev redeem reserve rewardTokens for Token given a rewardToken amount
     * This is called by the TokenController to balance the reserve
     * @param _value amount of Token to deposit for rewardTokens
     */
    function opportunityReserveRedeem(uint256 _value) external onlyOwner {
        reserveRedeem(_value, opportunity());
    }

    /**
     * @dev mint reserve rewardTokens for opportunity given a Token deposit
     * This is called by the TokenController to balance the reserve
     * @param _value amount of Token to deposit for rewardTokens
     */
    function opportunityReserveMint(uint256 _value) external onlyOwner {
        reserveMint(_value, opportunity());
    }

    /**
     * @dev set a new opportunity financial opportunity address
     * @param _opportunity new opportunity to set
     */
    function setOpportunityAddress(address _opportunity) external onlyOwner {
        opportunity_ = _opportunity;
    }

    /**
     * @dev Get opportunity financial opportunity address
     * @return address opportunity financial opportunity address
     */
    function opportunity() public view returns (address) {
        return opportunity_;
    }

    /**
     * @dev Get total supply of opportunity rewardTokens
     * @return total supply of opportunity rewardTokens
     */
    function opportunitySupply() internal view returns (uint256) {
        return rewardTokenSupply(opportunity());
    }

    /**
     * @dev Transfer helper for accounts with rewardToken balances
     * Uses reserve float to save gas costs for transactions with value < reserve balance
     * Case #2 and #3 use reserve balances
     *
     * There are 6 transfer cases
     *  1. Both sender and receiver are disabled (see _transferAllArgs)
     *  2. Sender enabled, receiver disabled, value < reserve TUSD balance
     *  3. Sender disabled, receiver enabled, value < reserve rewardToken balance (in TUSD)
     *  4. Both sender and receiver are enabled
     *  5. Sender enabled, receiver disabled, value > reserve TUSD balance
     *  6. Sender disabled, receiver enabled, value > reserve rewardToken balance (in TUSD)
     *
     * @param _from account to transfer from
     * @param _to account to transfer to
     * @param _value value in Token to transfer
     * @return actual value transferred
     */
    function _transferWithRewards(
        address _from,
        address _to,
        uint256 _value
    ) internal returns (uint256) {
        // get enable stat
        bool fromEnabled = trueRewardEnabled(_from);
        bool toEnabled = trueRewardEnabled(_to);

        // get opportunity address
        address finOp = opportunity();

        // calculate rewardToken balance
        uint rewardAmount = _toRewardToken(_value, finOp);

        // 2. Sender enabled, receiver disabled, value < reserve TUSD balance
        // Swap rewardToken for Token through reserve
        if (fromEnabled && !toEnabled && _value <= reserveBalance()) {
            swapRewardForToken(_from, _to, _value, finOp);
        }
        // 3. Sender disabled, receiver enabled, value < reserve rewardToken balance
        // Swap Token for rewardToken through reserve
        else if (!fromEnabled && toEnabled && rewardAmount <= rewardTokenBalance(RESERVE, finOp)) {
            swapTokenForReward(_from, _to, _value, finOp);
        }
        // 4. Sender and receiver are enabled
        // Here we simply transfer rewardToken from the sender to the receiver
        else if (fromEnabled && toEnabled) {
            _subRewardBalance(_from, rewardAmount, finOp);
            _addRewardBalance(_to, rewardAmount, finOp);
        }
        // 5. Sender enabled, receiver disabled, value > reserve TUSD balance
        // Recalculate value based on redeem value returned and give value to receiver
        else if (fromEnabled && !toEnabled) {
            _getFinOp(finOp).redeem(_to, rewardAmount);

            // decrease finOp rewardToken supply
            finOpSupply[finOp] = finOpSupply[finOp].sub(rewardAmount);

            // decrease account rewardToken balance
            _subRewardBalance(_from, rewardAmount, finOp);
        }
        // 6. Sender disabled, receiver enabled, value > reserve rewardToken balance
        // Transfer Token value between accounts and mint reward token for receiver
        else if (!fromEnabled && toEnabled) {
            // deposit into finOp
            approve(finOp, _value);
            uint256 depositedAmount = _getFinOp(finOp).deposit(_from, _value);

            // increase finOp rewardToken supply
            finOpSupply[finOp] = finOpSupply[finOp].add(depositedAmount);

            // increase account rewardToken balance
            _addRewardBalance(_to, depositedAmount, finOp);
        }
        return _value;
    }

    /**
     * @dev Transfer helper function for TrueRewardBackedToken
     */
    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        // 1. Both sender and receiver are disabled
        // Exchange is in TUSD -> call the normal transfer function
        if (!trueRewardEnabled(_from) && !trueRewardEnabled(_to)) {
            // sender not enabled receiver not enabled
            super._transferAllArgs(_from, _to, _value);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");

        // require account is not blacklisted and check if hook is registered
        (address finalTo, bool hasHook) = _requireCanTransfer(_from, _to);

        _value = _transferWithRewards(_from, finalTo, _value);

        // emit transfer event for from
        emit Transfer(_from, _to, _value);
        if (finalTo != _to) {
            emit Transfer(_to, finalTo, _value);
            if (hasHook) {
                TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
            }
        } else {
            if (hasHook) {
                TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
            }
        }
    }

    /**
     * @dev TransferFromAll helper function for TrueRewardBackedToken
     */
    function _transferFromAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal {
        // 1. Both sender and receiver are disabled -> normal transfer
        if (!trueRewardEnabled(_from) && !trueRewardEnabled(_to)) {
            super._transferFromAllArgs(_from, _to, _value, _spender);
            return;
        }

        // check balance
        require(balanceOf(_from) >= _value, "not enough balance");

        (address finalTo, bool hasHook) = _requireCanTransferFrom(_spender, _from, _to);

        // call transfer helper
        _value = _transferWithRewards(_from, finalTo, _value);

        // sub allowance of spender
        _subAllowance(_from, _spender, _value);

        // emit transfer event. For hook emit second transfer event
        // call fallback function for valid hook
        emit Transfer(_from, _to, _value);
        if (finalTo != _to) {
            emit Transfer(_to, finalTo, _value);
            if (hasHook) {
                TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
            }
        } else {
            if (hasHook) {
                TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
            }
        }
    }

    /**
     * @dev Set reward distribution for an opportunity
     *
     * @param proportion to set
     * @param finOp financial opportunity to set proportion for
     */
    function _setDistribution(uint256 proportion, address finOp) internal {
        require(proportion <= maxRewardProportion, "exceeds maximum proportion");
        require(_rewardDistribution[msg.sender].length == 0, "already enabled");
        _rewardDistribution[msg.sender].push(
            RewardAllocation(proportion, finOp));
    }

    /**
     * @dev Remove reward distribution for a financial opportunity
     * Remove
     */
    function _removeDistribution(address finOp) internal {
        delete _rewardDistribution[msg.sender][0];
        _rewardDistribution[msg.sender].length--;
    }
}
