// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";

import {ERC20} from "../common/UpgradeableERC20.sol";

contract TrueCreditLine is ERC20 {
    using SafeMath for uint256;
    using SafeERC20 for ERC20;

    uint256 constant PRECISION = 1e30;

    address public creditAgency;
    address public borrower;
    ITrueFiPool2 public pool;

    uint256 public principalDebt;

    // track overall cumulative rewards
    uint256 public cumulativeTotalRewardPerToken;
    /**
     * track previous cumulative rewards for accounts
     * @notice this is not cumulated reward for address,
     * it is total cumulative total reward written, last time an update has been made for that address
     */
    mapping(address => uint256) public previousCumulatedRewardPerToken;

    // track claimable rewards for accounts
    mapping(address => uint256) public claimableRewards;

    uint256 public totalInterestRewards;
    uint256 public totalClaimedRewards;

    /**
     * @dev Emitted when an account claims TRU rewards
     * @param who Account claiming
     * @param amountClaimed Amount of TRU claimed
     */
    event Claimed(address indexed who, uint256 amountClaimed);

    /**
     * @dev Emitted when borrower increases principal debt
     * @param borrower Borrowers address
     * @param increasedAmount Increased amount
     */
    event DebtIncreased(address indexed borrower, uint256 increasedAmount);

    /**
     * @dev Create Credit Line
     * @param _borrower Borrower address
     * @param _pool Pool to which the credit line is attached to
     * @param _principalDebt Initial amount of debt taken by borrower
     */
    constructor(
        address _creditAgency,
        address _borrower,
        ITrueFiPool2 _pool,
        uint256 _principalDebt
    ) public {
        ERC20.__ERC20_initialize("TrueFi Credit Line", "tfCL");

        creditAgency = _creditAgency;
        borrower = _borrower;
        pool = _pool;

        principalDebt = _principalDebt;
        _mint(address(_pool), _principalDebt);
    }

    modifier onlyCreditAgency() {
        require(msg.sender == creditAgency, "TrueCreditLine: Caller is not the credit agency");
        _;
    }

    /**
     * @dev Update state of rewards
     */
    modifier update(address account) {
        // calculate total rewards
        uint256 newTotalInterestRewards = token().balanceOf(address(this)).add(totalClaimedRewards).mul(PRECISION);
        // calculate new reward
        uint256 totalNewRewards = newTotalInterestRewards.sub(totalInterestRewards);
        // update interest rewards
        totalInterestRewards = newTotalInterestRewards;
        cumulativeTotalRewardPerToken = cumulativeTotalRewardPerToken.add(totalNewRewards.div(principalDebt));
        // update claimable reward for sender
        claimableRewards[account] = claimableRewards[account].add(
            balanceOf(account).mul(cumulativeTotalRewardPerToken.sub(previousCumulatedRewardPerToken[account])).div(PRECISION)
        );
        // update previous cumulative for sender
        previousCumulatedRewardPerToken[account] = cumulativeTotalRewardPerToken;
        _;
    }

    /**
     * @dev Function called by credit agency to increase the principal debt,
     * withdraw tokens from the pool and mint CL tokens to the pool accordingly
     */
    function increasePrincipalDebt(uint256 amount) external onlyCreditAgency {
        principalDebt = principalDebt.add(amount);
        _mint(address(pool), amount);
        emit DebtIncreased(borrower, amount);
    }

    /**
     * @dev View to estimate the claimable reward for an account
     * @return claimable rewards for account
     */
    function claimable(address account) external view returns (uint256) {
        // calculate total rewards (including not updated)
        uint256 newTotalInterestRewards = token().balanceOf(address(this)).add(totalClaimedRewards);
        // calculate new reward
        uint256 totalNewRewards = newTotalInterestRewards.sub(totalInterestRewards);
        // calculate next cumulative reward per token
        uint256 nextcumulativeRewardPerToken = cumulativeTotalRewardPerToken.add(totalNewRewards.div(principalDebt));
        // return claimable reward for this account
        // prettier-ignore
        return claimableRewards[account].add(
            balanceOf(account).mul(nextcumulativeRewardPerToken.sub(previousCumulatedRewardPerToken[account])).div(PRECISION)
        );
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override update(sender) update(recipient) {
        super._transfer(sender, recipient, amount);
    }

    /**
     * @dev Claim interest rewards
     */
    function claim() external {
        _claim(msg.sender);
    }

    /**
     * @dev Function used by the borrower to pay periodic interest
     */
    function payInterest(uint256 amount) external {
        token().safeTransferFrom(msg.sender, address(this), amount);
        _claim(address(pool));
    }

    function token() public view returns (ERC20) {
        return pool.token();
    }

    function version() external pure returns (uint8) {
        return 0;
    }

    /**
     * @dev Internal claim function
     */
    function _claim(address account) internal update(account) {
        totalClaimedRewards = totalClaimedRewards.add(claimableRewards[account]);
        uint256 rewardToClaim = claimableRewards[account];
        claimableRewards[account] = 0;
        token().safeTransfer(account, rewardToClaim);
        emit Claimed(account, rewardToClaim);
    }
}
