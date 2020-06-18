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

    event SwapRewardForToken(address account, uint256 amount, address finOp);
    event SwapTokenForReward(address account, uint256 amount, address finOp);

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
        _transferWithHook(RESERVE, to, value);
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
        addRewardTokenToReserve(account, depositAmount, rewardAmount, finOp);
        withdrawTokenFromReserve(account, depositAmount);
        emit SwapTokenForReward(account, depositAmount, finOp);
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
        addTokenToReserve(account, depositAmount);
        withdrawRewardTokenFromReserve(account, depositAmount, rewardAmount, finOp);
        emit SwapRewardForToken(account, depositAmount, finOp);
    }

    function addTokenToReserve(
        address account,
        uint256 amount
    ) internal {
        // sub from sender and add to reserve for depositToken
        _subBalance(account, amount);
        _addBalance(RESERVE, amount);

        emit Transfer(account, RESERVE, amount);
    }

    function withdrawTokenFromReserve(
        address account,
        uint256 amount
    ) internal {
        // sub from sender and add to reserve for depositToken
        _subBalance(RESERVE, amount);
        _addBalance(account, amount);

        emit Transfer(RESERVE, account, amount);
    }

    function addRewardTokenToReserve(
        address account,
        uint256 depositAmount,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) {
        // sub from reserve and add to sender for rewardToken
        _subRewardBalance(account, rewardAmount, finOp);
        _addRewardBalance(RESERVE, rewardAmount, finOp);

        emit Transfer(account, RESERVE, depositAmount);
    }

    function withdrawRewardTokenFromReserve(
        address account,
        uint256 depositAmount,
        uint256 rewardAmount,
        address finOp
    ) internal validFinOp(finOp) {
        // sub from reserve and add to sender for rewardToken
        _subRewardBalance(RESERVE, rewardAmount, finOp);
        _addRewardBalance(account, rewardAmount, finOp);

        emit Transfer(RESERVE, account, depositAmount);
    }
}
