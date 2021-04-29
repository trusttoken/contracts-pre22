// SPDX-License-Identifier: MIT
// Copied from https://github.com/sushiswap/sushiswap/blob/master/contracts/mocks/RewarderMock.sol
// Adapted to reward TRU instead

pragma solidity 0.6.10;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {ISushiswapRewarder} from "./interface/ISushiswapRewarder.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

contract TruSushiswapRewarder is ISushiswapRewarder, UpgradeableClaimable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    uint256 private rewardMultiplier;
    IERC20 private trustToken;
    address private MASTERCHEF_V2;

    // ======= STORAGE DECLARATION END ===========

    uint256 private constant REWARD_TOKEN_DIVISOR = 1e18;

    /**
     * @dev Initialize this contract with provided parameters
     * @param _rewardMultiplier conversion factor between sushiAmount and TruAmount
     * @param _trustToken TRU address
     * @param _MASTERCHEF_V2 Sushiswap MasterChef address
     */
    function initialize(
        uint256 _rewardMultiplier,
        IERC20 _trustToken,
        address _MASTERCHEF_V2
    ) external initializer {
        rewardMultiplier = _rewardMultiplier;
        trustToken = _trustToken;
        MASTERCHEF_V2 = _MASTERCHEF_V2;
    }

    /**
     * @dev Hook called on sushi reward
     * Calculate token reward amount based on sushi reward amount
     */
    function onSushiReward(
        uint256, /* pid */
        address, /* user */
        address recipient,
        uint256 sushiAmount,
        uint256 /* newLpAmount */
    ) external override onlyMCV2 {
        uint256 pendingReward = sushiAmount.mul(rewardMultiplier) / REWARD_TOKEN_DIVISOR;
        uint256 rewardBal = trustToken.balanceOf(address(this));
        if (pendingReward > rewardBal) {
            trustToken.safeTransfer(recipient, rewardBal);
        } else {
            trustToken.safeTransfer(recipient, pendingReward);
        }
    }

    /**
     * @dev Get pending token rewards
     * Calculate token reward amount based on sushi reward amount
     * @return rewardTokens Array of token addresses to be granted
     * @return rewardAmounts Amounts of reward tokens corresponding to `rewardTokens`
     */
    function pendingTokens(
        uint256, /* pid */
        address, /* user */
        uint256 sushiAmount
    ) external override view returns (IERC20[] memory rewardTokens, uint256[] memory rewardAmounts) {
        IERC20[] memory _rewardTokens = new IERC20[](1);
        _rewardTokens[0] = (trustToken);
        uint256[] memory _rewardAmounts = new uint256[](1);
        _rewardAmounts[0] = sushiAmount.mul(rewardMultiplier) / REWARD_TOKEN_DIVISOR;
        return (_rewardTokens, _rewardAmounts);
    }

    modifier onlyMCV2 {
        require(msg.sender == MASTERCHEF_V2, "Only MCV2 can call this function.");
        _;
    }
}
