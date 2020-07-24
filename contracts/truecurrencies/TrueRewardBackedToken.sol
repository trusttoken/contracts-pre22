// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {TrueCoinReceiver} from "./TrueCoinReceiver.sol";
import {RewardTokenWithReserve} from "./RewardTokenWithReserve.sol";

/**
 * @title TrueRewardBackedToken
 * @dev TrueRewardBackedToken is TrueCurrency backed by debt
 *
 * -- Overview --
 * Enabling TrueRewards deposits TrueCurrency into a financial opportunity
 * Financial opportunities provide awards over time
 * Awards are reflected in the wallet balance updated block-by-block
 *
 * -- rewardToken vs yToken --
 * rewardToken represents an amount of ASSURED TrueCurrency owed to the rewardToken holder
 * yToken represents an amount of NON-ASSURED TrueCurrency owed to a yToken holder
 * For this contract, we only handle rewardToken (Assured Opportunities)
 *
 * -- Calculating rewardToken --
 * TrueCurrency Value = rewardToken * financial opportunity tokenValue()
 *
 * -- rewardToken Assumptions --
 * We assume tokenValue never decreases for assured financial opportunities
 * rewardToken is not transferable in that the token itself is never transferred
 * Rather, we override our transfer functions to account for user balances
 *
 * -- Reserve --
 * This contract uses a reserve holding of TrueCurrency and rewardToken to save on gas costs
 * because calling the financial opportunity deposit() and redeem() every time
 * can be expensive
 * See RewardTokenWithReserve.sol
 *
 * -- Future Upgrades to Financial Opportunity --
 * Currently, we only have a single financial opportunity
 * We plan on upgrading this contract to support a multiple financial opportunity,
 * so some of the code is built to support this
 *
 */
abstract contract TrueRewardBackedToken is RewardTokenWithReserve {
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

    /// @dev Emitted when true reward was enabled for _account with balance _amount for Financial Opportunity _finOp
    event TrueRewardEnabled(address indexed _account, uint256 _amount, address indexed _finOp);
    /// @dev Emitted when true reward was disabled for _account with balance _amount for Financial Opportunity _finOp
    event TrueRewardDisabled(address indexed _account, uint256 _amount, address indexed _finOp);

    /** @dev return true if TrueReward is enabled for a given address */
    function trueRewardEnabled(address _address) public view returns (bool) {
        return _rewardDistribution[_address].length != 0;
    }

    /**
     * @dev Get total supply of all TrueCurrency
     * Equal to deposit backed TrueCurrency plus debt backed TrueCurrency
     * @return total supply in trueCurrency
     */
    function totalSupply() public virtual override view returns (uint256) {
        // if supply in opportunity finOp, return supply of deposits + debt
        // otherwise call super to return normal totalSupply
        if (opportunityRewardSupply() != 0) {
            return totalSupply_.add(opportunityTotalSupply());
        }
        return totalSupply_;
    }

    /**
     * @dev get total supply of TrueCurrency backed by fiat deposits
     * @return supply of fiat backed TrueCurrency
     */
    function depositBackedSupply() public view returns (uint256) {
        return totalSupply_;
    }

    /**
     * @dev get total supply of TrueCurrency backed by debt
     * @return supply of debt backed TrueCurrency
     */
    function rewardBackedSupply() public view returns (uint256) {
        return totalSupply().sub(totalSupply_);
    }

    /**
     * @dev Get balance of TrueCurrency including rewards for an address
     *
     * @param _who address of account to get balanceOf for
     * @return balance total balance of address including rewards
     */
    function balanceOf(address _who) public virtual override view returns (uint256) {
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
        require(registry.hasAttribute(msg.sender, IS_TRUEREWARDS_WHITELISTED), "must be whitelisted to enable TrueRewards");
        require(!trueRewardEnabled(msg.sender), "TrueReward already enabled");

        // get sender balance
        uint256 balance = _getBalance(msg.sender);

        if (balance != 0) {
            // deposit entire user token balance
            depositWithReserve(msg.sender, balance, opportunity());
        }

        // set reward distribution
        // we set max distribution since we only have one opportunity
        _setDistribution(maxRewardProportion, opportunity());

        // emit enable event
        emit TrueRewardEnabled(msg.sender, balance, opportunity());
    }

    /**
     * @dev Disable TrueReward and withdraw user balance from opportunity.
     */
    function disableTrueReward() external {
        // require TrueReward is enabled
        require(trueRewardEnabled(msg.sender), "TrueReward already disabled");
        // get balance
        uint256 rewardBalance = rewardTokenBalance(msg.sender, opportunity());

        // remove reward distribution
        _removeDistribution(opportunity());

        if (rewardBalance > 0) {
            // redeem entire user reward token balance
            redeemWithReserve(msg.sender, rewardBalance, opportunity());
        }

        // emit disable event
        emit TrueRewardDisabled(msg.sender, rewardBalance, opportunity());
    }

    /**
     * @dev mint function for TrueRewardBackedToken
     * Mints TrueCurrency backed by debt
     * When we add multiple opportunities, this needs to work for multiple interfaces
     */
    function mint(address _to, uint256 _value) public virtual override onlyOwner {
        // check if to address is enabled
        bool toEnabled = trueRewardEnabled(_to);

        // if to enabled, mint to this contract and deposit into finOp
        if (toEnabled) {
            // mint to this contract
            super.mint(address(this), _value);
            // transfer minted amount to target receiver
            _transferAllArgs(address(this), _to, _value);
        } else {
            // otherwise call normal mint process
            super.mint(_to, _value);
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
     * @dev Get (assured) financial opportunity address
     * @return address financial opportunity address
     */
    function opportunity() public view returns (address) {
        return opportunity_;
    }

    /**
     * @dev Get total supply of opportunity rewardToken
     * @return total supply of opportunity rewardToken
     */
    function opportunityRewardSupply() internal view returns (uint256) {
        if (opportunity() == address(0)) {
            return 0;
        }
        return rewardTokenSupply(opportunity());
    }

    /**
     * @dev Get total supply of TrueCurrency in opportunity
     * @return total supply of TrueCurrency in opportunity
     */
    function opportunityTotalSupply() internal view returns (uint256) {
        return _toToken(opportunityRewardSupply(), opportunity());
    }

    /**
     * @dev Transfer helper function for TrueRewardBackedToken
     *
     * Uses trueRewardEnabled flag to check whether accounts have opted in
     * If are have opted out, call parent transferFrom, otherwise:
     * 1. If sender opted in, redeem reward tokens for true currency
     * 2. Call transferFrom, using deposit balance for transfer
     * 3. If receiver enabled, deposit true currency into
     */
    function _transferAllArgs(
        address _from,
        address _to,
        uint256 _value
    ) internal virtual override returns (address) {
        // get enabled flags and opportunity address
        bool fromEnabled = trueRewardEnabled(_from);
        bool toEnabled = trueRewardEnabled(_to);
        address finOp = opportunity();

        // if both disabled or either is opportunity, transfer normally
        if ((!fromEnabled && !toEnabled) || _from == finOp || _to == finOp) {
            require(super.balanceOf(_from) >= _value, "not enough balance");
            return super._transferAllArgs(_from, _to, _value);
        }

        // check balance for from address
        require(balanceOf(_from) >= _value, "not enough balance");

        // if from enabled, check balance, calculate reward amount, and redeem
        if (fromEnabled) {
            uint256 rewardAmount = _toRewardToken(_value, finOp);
            _value = redeemWithReserve(_from, _value, rewardAmount, finOp);
        }

        // transfer tokens
        address finalTo = super._transferAllArgs(_from, _to, _value);

        // if receiver enabled, deposit tokens into opportunity
        if (trueRewardEnabled(finalTo)) {
            depositWithReserve(finalTo, _value, finOp);
        }

        return finalTo;
    }

    /**
     * @dev TransferFrom helper function for TrueRewardBackedToken
     *
     * Uses trueRewardEnabled flag to check whether accounts have opted in
     * If are have opted out, call parent transferFrom, otherwise:
     * 1. If sender opted in, redeem reward tokens for true currency
     * 2. Call transferFrom, using deposit balance for transfer
     * 3. If receiver enabled, deposit true currency into
     */
    function _transferFromAllArgs(
        address _from,
        address _to,
        uint256 _value,
        address _spender
    ) internal virtual override returns (address) {
        // get enabled flags and opportunity address
        bool fromEnabled = trueRewardEnabled(_from);
        bool toEnabled = trueRewardEnabled(_to);
        address finOp = opportunity();

        // if both disabled or either is opportunity, transfer normally
        if ((!fromEnabled && !toEnabled) || _from == finOp || _to == finOp) {
            require(super.balanceOf(_from) >= _value, "not enough balance");
            return super._transferFromAllArgs(_from, _to, _value, _spender);
        }

        // check balance for from address
        require(balanceOf(_from) >= _value, "not enough balance");

        // if from enabled, check balance, calculate reward amount, and redeem
        if (fromEnabled) {
            uint256 rewardAmount = _toRewardToken(_value, finOp);
            _value = redeemWithReserve(_from, rewardAmount, finOp);
        }

        // transfer tokens
        address finalTo = super._transferFromAllArgs(_from, _to, _value, _spender);

        // if receiver enabled, deposit tokens into opportunity
        if (trueRewardEnabled(finalTo)) {
            depositWithReserve(finalTo, _value, finOp);
        }

        return finalTo;
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
        _rewardDistribution[msg.sender].push(RewardAllocation(proportion, finOp));
    }

    /**
     * @dev Remove reward distribution for a financial opportunity
     */
    function _removeDistribution(address) internal {
        _rewardDistribution[msg.sender].pop();
    }
}
