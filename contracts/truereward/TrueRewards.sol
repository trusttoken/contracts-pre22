// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FinancialOpportunity} from "./FinancialOpportunity.sol";
import {TrueRewardsStorage} from "./TrueRewardsStorage.sol";
import {InitializableClaimable} from "../truecurrencies/modularERC20/InitializableClaimable.sol";

contract TrueRewards is TrueRewardsStorage, InitializableClaimable {
    using SafeMath for uint256;

    modifier onlyToken() {
        require(msg.sender == address(trueRewardToken), "can be called only by token");
        _;
    }

    function initialize(IERC20 _trueRewardToken, FinancialOpportunity finOp) external {
        _configure();
        trueRewardToken = _trueRewardToken;
        financialOpportunities.push(finOp);
    }

    function deposit(address account, uint256 amount) external onlyToken {
        require(trueRewardToken.balanceOf(address(this)) >= amount);
        depositToFinOp(account, amount, address(financialOpportunities[0]));
    }

    function redeem(address account, uint256 amount) external onlyToken {
        uint256 totalAmountRedeemed = redeemFromFinOp(
            account,
            toReward(amount, financialOpportunities[0]),
            address(financialOpportunities[0])
        );
        require(trueRewardToken.transfer(account, totalAmountRedeemed), "transfer failed");
    }

    function redeemAll(address account) external onlyToken {
        uint256 totalAmountRedeemed = redeemAllFromFinOp(account, address(financialOpportunities[0]));
        require(trueRewardToken.transfer(account, totalAmountRedeemed), "transfer failed");
    }

    function getBalance(address account) external view returns (uint256 balance) {
        for (uint256 i = 0; i < financialOpportunities.length; i++) {
            balance = balance.add(getFinOpBalance(account, financialOpportunities[i]));
        }
    }

    function totalSupply() external view returns (uint256 supply) {
        for (uint256 i = 0; i < financialOpportunities.length; i++) {
            supply = supply.add(fromReward(finOpSupply[address(financialOpportunities[i])], financialOpportunities[i]));
        }
    }

    function depositToFinOp(
        address account,
        uint256 depositAmount,
        address finOp
    ) internal virtual returns (uint256) {
        // approve finOp can spend Token
        trueRewardToken.approve(finOp, depositAmount);

        // deposit into finOp
        uint256 rewardAmount = FinancialOpportunity(finOp).deposit(account, depositAmount);

        // increase finOp rewardToken supply
        finOpSupply[finOp] = finOpSupply[finOp].add(rewardAmount);

        // increase account rewardToken balance
        finOpBalances[finOp][account] = finOpBalances[finOp][account].add(rewardAmount);

        return rewardAmount;
    }

    function redeemAllFromFinOp(address account, address finOp) internal returns (uint256) {
        return redeemFromFinOp(account, finOpBalances[finOp][account], finOp);
    }

    function redeemFromFinOp(
        address account,
        uint256 rewardAmount,
        address finOp
    ) internal virtual returns (uint256) {
        require(finOpBalances[finOp][account] >= rewardAmount, "insufficient reward balance");

        // decrease finOp rewardToken supply
        finOpSupply[finOp] = finOpSupply[finOp].sub(rewardAmount);

        // decrease account reward balance
        finOpBalances[finOp][account] = finOpBalances[finOp][account].sub(rewardAmount);

        // withdraw from finOp, giving TrueRewardBackedToken to account
        return FinancialOpportunity(finOp).redeem(account, rewardAmount);
    }

    /**
     * @dev Get trueRewardToken balance deposited into finOp by account
     */
    function getFinOpBalance(address account, FinancialOpportunity finOp) internal view returns (uint256) {
        return fromReward(finOpBalances[address(finOp)][account], finOp);
    }

    /**
     * @dev Utility to get trueRewardToken amount from rewards value
     *
     * @param rewardAmount rewardAmount amount to convert to trueRewardToken
     * @param finOp financial opportunity address
     */
    function fromReward(uint256 rewardAmount, FinancialOpportunity finOp) internal view returns (uint256) {
        uint256 ratio = finOp.tokenValue();
        return rewardAmount.mul(ratio).div(10**18);
    }

    /**
     * @dev Utility to get reward amount from trueRewardToken value
     *
     * @param amount amount of trueRewardTokens to convert to rewards
     * @param finOp financial opportunity address
     */
    function toReward(uint256 amount, FinancialOpportunity finOp) internal view returns (uint256) {
        uint256 ratio = finOp.tokenValue();
        return amount.mul(10**18).div(ratio);
    }
}
