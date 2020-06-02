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

    event SwapRewardForToken(address account, address receiver, uint256 amount, address finOp);
    event SwapTokenForReward(address account, address receiver, uint256 amount, address finOp);

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
     * @param sender account to deduct token from
     * @param receiver account to add rewardToken to
     * @param amount Token amount to exchange for rewardToken
     * @param finOp financial opportunity to swap tokens for
     */
    function swapTokenForReward(
        address sender,
        address receiver,
        uint256 amount,
        address finOp
    ) internal validFinOp(finOp) {
        // require sender has sufficient balance
        require(balanceOf(sender) >= amount, "insufficient balance");

        // calculate rewardToken value for depositToken amount
        uint256 rewardAmount = _toRewardToken(amount, finOp);

        // require reserve
        require(rewardTokenBalance(RESERVE, finOp) >= rewardAmount, "not enough rewardToken in reserve");

        // sub from sender and add to reserve for depositToken
        _subBalance(sender, amount);
        _addBalance(RESERVE, amount);

        // sub from reserve and add to sender for rewardToken
        _subRewardBalance(RESERVE, rewardAmount, finOp);
        _addRewardBalance(receiver, rewardAmount, finOp);

        // emit event
        emit SwapTokenForReward(sender, receiver, amount, finOp);
    }

    /**
     * @dev Use reserve to swap rewardToken for Token between accounts
     *
     * @param sender account to swap rewardToken from
     * @param receiver account to add Token to
     * @param tokenAmount token amount to receive for Token
     * @param finOp financial opportunity
     */
    function swapRewardForToken(
        address sender,
        address receiver,
        uint256 tokenAmount,
        address finOp
    ) internal validFinOp(finOp) {
        // ensure reserve has enough balance
        require(balanceOf(RESERVE) >= tokenAmount, "not enough depositToken in reserve");

        uint256 rewardAmount = _toRewardToken(tokenAmount, finOp);

        // require sufficient balance
        require (rewardTokenBalance(sender, finOp) >= rewardAmount, "insufficient rewardToken balance");

        // sub account and add reserve for rewardToken
        _subRewardBalance(sender, rewardAmount, finOp);
        _addRewardBalance(RESERVE, rewardAmount, finOp);

        // sub account and add reserve for Token
        _subBalance(RESERVE, tokenAmount);
        _addBalance(receiver, tokenAmount);

        // emit event
        emit SwapRewardForToken(sender, receiver, rewardAmount, finOp);
    }
}
