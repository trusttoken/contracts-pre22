// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {FinancialOpportunity} from "../truereward/FinancialOpportunity.sol";
import {CompliantDepositToken} from "./CompliantDepositToken.sol";

/**
 * @title RewardToken
 * @dev Non-transferable token meant to represent
 * RewardTokens are trueCurrencies owed by a financial opportunity
 *
 * -- Overview --
 * RewardTokens are redeemable for an underlying Token.
 * RewardTokens are non-transferable for compliance reasons
 * The caller of depositor is responsible for exchanging their
 * tokens, rather just keep accounting of user rewardToken balances
 *
 * -- Financial Opportunity --
 * RewardTokens are backed by an underlying financial opportunity
 * Each financial opportunity can accept Token deposits for
 * See FinancialOpportunity.sol
 *
 * -- Mint/Redeem/Burn --
 * To create rewardTokens, we call mintRewardToken with some amount of TUSD
 * To redeem rewardTokens we call redeemRewardToken and receive TUSD
 * Only the account that has rewardTokens can burn reward tokens. The only
 * time we would want to burn rewardTokens is if the underlying opportunity
 * is no longer redeemable, and we want to wipe the debt.
 *
 * -- Mint/Burn RewardBackedToken
 * RewardBackedToken represents trueCurrencies supply backed by Rewards
 *
 */
abstract contract RewardToken is CompliantDepositToken {
    /* variables in proxy storage
    mapping(address => FinancialOpportunity) finOps;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;
    */

    /**
     * @dev Emitted when tokens were exchanged for reward tokens
     * @param account Token holder
     * @param tokensDeposited How many tokens were deposited
     * @param rewardTokensMinted How many reward tokens were minted
     * @param finOp The financial opportunity that backs reward tokens
     */
    event MintRewardToken(address indexed account, uint256 tokensDeposited, uint256 rewardTokensMinted, address indexed finOp);

    /**
     * @dev Emitted when reward tokens were exchanged for tokens
     * @param account Token holder
     * @param tokensWithdrawn How many tokens were withdrawn
     * @param rewardTokensRedeemed How many reward tokens were redeemed
     * @param finOp The financial opportunity that backs reward tokens
     */
    event RedeemRewardToken(address indexed account, uint256 tokensWithdrawn, uint256 rewardTokensRedeemed, address indexed finOp);

    /**
     * @dev Emitted when reward tokens are burnt
     * @param account Token holder
     * @param rewardTokenAmount How many reward tokens were burnt
     * @param finOp The financial opportunity that backs reward tokens
     */
    event BurnRewardToken(address indexed account, uint256 rewardTokenAmount, address indexed finOp);

    /**
     * @dev Emitted when new reward tokens were minted
     * @param account Token holder
     * @param amount How many tokens were minted
     */
    event MintRewardBackedToken(address indexed account, uint256 indexed amount);

    /**
     * @dev Emitted when reward tokens were burnt
     * @param account Token holder
     * @param amount How many tokens were burnt
     */
    event BurnRewardBackedToken(address indexed account, uint256 indexed amount);

    /**
     * @dev Only addresses registered in this contract's mapping are valid
     *
     * @param finOp reverts if this finOp is not registered
     */
    modifier validFinOp(address finOp) {
        require(finOp != address(0), "invalid opportunity");
        _;
    }

    /**
     * @dev get debt balance of account in rewardToken
     *
     * @param finOp financial opportunity
     */
    function rewardTokenSupply(address finOp) public view validFinOp(finOp) returns (uint256) {
        return finOpSupply[finOp];
    }

    /**
     * @dev get debt balance of account in rewardToken
     *
     * @param account account to get rewardToken balance of
     * @param finOp financial opportunity
     */
    function rewardTokenBalance(address account, address finOp) public view validFinOp(finOp) returns (uint256) {
        return finOpBalances[finOp][account];
    }

    /**
     * @dev mint rewardToken for financial opportunity
     *
     * For valid finOp, deposit Token into finOp
     * Update finOpSupply & finOpBalance for account
     * Emit mintRewardToken event on success
     *
     * @param account account to mint rewardToken for
     * @param depositAmount amount of depositToken to deposit
     * @param finOp financial opportunity address
     */
    function mintRewardToken(
        address account,
        uint256 depositAmount,
        address finOp
    ) internal validFinOp(finOp) returns (uint256) {
        // approve finOp can spend Token
        _setAllowance(account, finOp, depositAmount);

        // deposit into finOp
        uint256 rewardAmount = _getFinOp(finOp).deposit(account, depositAmount);

        // increase finOp rewardToken supply
        finOpSupply[finOp] = finOpSupply[finOp].add(rewardAmount);

        // increase account rewardToken balance
        _addRewardBalance(account, rewardAmount, finOp);

        // emit mint event
        emit MintRewardToken(account, depositAmount, rewardAmount, finOp);
        emit MintRewardBackedToken(account, depositAmount);
        emit Transfer(address(0), account, depositAmount);

        return rewardAmount;
    }

    /**
     * @dev redeem rewardToken balance for depositToken
     *
     * For valid finOp, deposit Token into finOp
     * Update finOpSupply & finOpBalance for account
     * Emit mintRewardToken event on success
     *
     * @param account account to redeem rewardToken for
     * @param rewardAmount rewardTokens amount to redeem
     * @param finOp financial opportunity address
     */
    function redeemRewardToken(
        address account,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) returns (uint256) {
        // require sufficient balance
        require(rewardTokenBalance(account, finOp) >= rewardAmount, "insufficient reward balance");

        // withdraw from finOp, giving TUSD to account
        uint256 tokenAmount = _getFinOp(finOp).redeem(account, rewardAmount);

        // decrease finOp rewardToken supply
        finOpSupply[finOp] = finOpSupply[finOp].sub(rewardAmount);

        // decrease account rewardToken balance
        _subRewardBalance(account, rewardAmount, finOp);

        emit RedeemRewardToken(account, tokenAmount, rewardAmount, finOp);
        emit BurnRewardBackedToken(account, tokenAmount);
        emit Transfer(account, address(0), tokenAmount);

        return tokenAmount;
    }

    /**
     * @dev burn rewardToken without redeeming
     *
     * Burn rewardToken for finOp
     *
     * @param account account to burn rewardToken for
     * @param rewardAmount rewardToken amount to burn
     * @param finOp financial opportunity address
     */
    function burnRewardToken(
        address account,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) {
        // burn call must come from sender
        require(msg.sender == account);

        // sender must have rewardToken amount to burn
        require(rewardTokenBalance(account, finOp) >= rewardAmount);

        // subtract reward balance from
        _subRewardBalance(account, rewardAmount, finOp);

        // reduce total supply
        finOpSupply[finOp].sub(rewardAmount);

        // calculate depositToken value
        uint256 tokenAmount = _toToken(rewardAmount, finOp);

        // burn event
        emit BurnRewardToken(account, rewardAmount, finOp);
        emit BurnRewardBackedToken(account, tokenAmount);
        emit Transfer(account, address(0), tokenAmount);
    }

    /**
     * @dev add rewardToken balance to account
     *
     * @param account account to add to
     * @param amount rewardToken amount to add
     * @param finOp financial opportunity to add reward tokens to
     */
    function _addRewardBalance(
        address account,
        uint256 amount,
        address finOp
    ) internal {
        finOpBalances[finOp][account] = finOpBalances[finOp][account].add(amount);
    }

    /**
     * @dev subtract rewardToken balance from account
     *
     * @param account account to subtract from
     * @param amount rewardToken amount to subtract
     * @param finOp financial opportunity
     */
    function _subRewardBalance(
        address account,
        uint256 amount,
        address finOp
    ) internal {
        finOpBalances[finOp][account] = finOpBalances[finOp][account].sub(amount);
    }

    /**
     * @dev Utility to convert depositToken value to rewardToken value
     *
     * @param amount depositToken amount to convert to rewardToken
     * @param finOp financial opportunity address
     */
    function _toRewardToken(uint256 amount, address finOp) internal view returns (uint256) {
        uint256 ratio = _getFinOp(finOp).tokenValue();
        return amount.mul(10**18).div(ratio);
    }

    /**
     * @dev Utility to convert rewardToken value to depositToken value
     *
     * @param amount rewardToken amount to convert to depositToken
     * @param finOp financial opportunity address
     */
    function _toToken(uint256 amount, address finOp) internal view returns (uint256) {
        uint256 ratio = _getFinOp(finOp).tokenValue();
        return ratio.mul(amount).div(10**18);
    }

    /**
     * @dev utility to get FinancialOpportunity for address
     *
     * @param finOp financial opportunity to get
     */
    function _getFinOp(address finOp) internal pure returns (FinancialOpportunity) {
        return FinancialOpportunity(finOp);
    }
}
