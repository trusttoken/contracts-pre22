pragma solidity 0.5.13;

import { RewardToken } from "./RewardToken.sol";

/**
 * @title RewardTokenWithReserve
 * @dev Provides a reserve to swap rewardTokens for gas savings
 *
 * -- Overview --
 * The Reserve holds Tokens and RewardTokens
 * Because gas costs can be high for depositing/redeeming in financial
 * opportunities, we use this contract to keep a reserve of tokens
 * to provide swap opportunities
 *
 */
contract RewardTokenWithReserve is RewardToken {

    // Reserve is an address which nobody has the private key to
    // Reserves of TUSD and TrueRewardBackedToken are held at this addess
    address public constant RESERVE = 0xf000000000000000000000000000000000000000;

    event SwapRewardForToken(address account, uint256 depositAmount, uint256 rewardAmount, address finOp);
    event SwapTokenForReward(address account, uint256 depositAmount, uint256 rewardAmount, address finOp);

    /**
     * @dev get reserve token balance
     *
     * @return token balance of reserve
     */
    function reserveBalance() public view returns (uint256) {
        return super.balanceOf(RESERVE);
    }

    /**
     * @dev Get rewardToken reserve balance
     *
     * @param finOp address of financial opportunity
     * @return rewardToken balance of reserve for finOp
     */
    function reserveRewardBalance(address finOp) public view returns (uint) {
        return rewardTokenBalance(RESERVE, finOp);
    }

    /**
     * @dev Withdraw Token from reserve through transferAll
     *
     * @param to address to withdraw to
     * @param value amount to withdraw
     */
    function reserveWithdraw(address to, uint256 value) external onlyOwner {
        _transferAllArgs(RESERVE, to, value);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is too much money in an opportunity and we want
     * to get more TrueCurrency.
     * This allows us to reduct the cost of transfers 5-10x in/out of opportunities
     *
     * @param amount amount of rewardTokens to redeem
     * @param finOp financial opportunity to redeem from
     */
    function reserveRedeem(uint256 amount, address finOp) internal {
        redeemRewardToken(RESERVE, amount, finOp);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is not enough rewardToken for an
     * opportunity and we want to add rewardTokens to the reserve
     *
     * @param amount amount of Token to redeem for rewardToken
     * @param finOp financial opportunity to redeem for
     */
    function reserveMint(uint256 amount, address finOp) internal {
        mintRewardToken(RESERVE, amount, finOp);
    }

    /**
     * @dev Use reserve to swap Token for rewardToken between accounts
     *
     * @param account account to swap token for
     * @param depositAmount deposit token amount to put into reserve
     * @param rewardAmount reward token amount to take from reserve
     * @param finOp financial opportunity to swap tokens for
     */
    function swapRewardForToken(
        address account,
        uint256 depositAmount,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) {
        // put reward tokens into reserve
        _subRewardBalance(account, rewardAmount, finOp);
        _addRewardBalance(RESERVE, rewardAmount, finOp);

        // take deposit tokens from reserve
        _subBalance(RESERVE, depositAmount);
        _addBalance(account, depositAmount);

        emit Transfer(account, RESERVE, depositAmount);
        emit Transfer(RESERVE, account, depositAmount);
        emit SwapTokenForReward(account, depositAmount, rewardAmount, finOp);
    }

    /**
     * @dev Use reserve to swap Token for rewardToken between accounts
     *
     * @param account account to swap token for
     * @param depositAmount deposit token amount to take from reserve
     * @param rewardAmount reward token amount to put into reserve
     * @param finOp financial opportunity to swap tokens for
     */
    function swapTokenForReward(
        address account,
        uint256 depositAmount,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) {
        // put deposit tokens into reserve
        _subBalance(account, depositAmount);
        _addBalance(RESERVE, depositAmount);

        // take reward tokens from reserve
        _subRewardBalance(RESERVE, rewardAmount, finOp);
        _addRewardBalance(account, rewardAmount, finOp);

        emit Transfer(account, RESERVE, depositAmount);
        emit Transfer(RESERVE, account, depositAmount);
        emit SwapRewardForToken(account, depositAmount, rewardAmount, finOp);
    }

    /**
     * @dev Redeem tokens from financial opportunity if reserve balance cannot cover it
     * swap with reserve otherwise
     *
     * @param account account which wants to redeem
     * @param depositAmount deposit token amount to take from reserve
     * @param rewardAmount reward token amount to put into reserve / redeem from opportunity
     * @param finOp financial opportunity we interact with
     */
    function redeemWithReserve(address account, uint256 depositAmount, uint256 rewardAmount, address finOp) internal returns (uint256) {
        if (reserveBalance() >= depositAmount) {
            swapRewardForToken(account, depositAmount, rewardAmount, finOp);
            return depositAmount;
        } else {
            return redeemRewardToken(account, rewardAmount, finOp);
        }
    }

    /**
     * @dev Deposit tokens into financial opportunity and mint new debt backed tokens
     * if reserve reward token balance is lower than deposited amount
     * swap with reserve otherwise
     *
     * @param account account which wants to redeem
     * @param depositAmount deposit token amount to put into reserve / redeem from opportunity
     * @param rewardAmount reward token amount to take from reserve
     * @param finOp financial opportunity we interact with
     */
    function depositWithReserve(address account, uint256 depositAmount, uint256 rewardAmount, address finOp) internal {
        if (rewardTokenBalance(RESERVE, finOp) >= rewardAmount) {
            swapTokenForReward(account, depositAmount, rewardAmount, finOp);
        } else {
            mintRewardToken(account, depositAmount, finOp);
        }
    }
}
