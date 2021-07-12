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

    address public borrower;
    ITrueFiPool2 public pool;

    uint256 public principalDebt;

    uint256 unpaidAccumulatedInterest;

    // track overall cumulative rewards
    uint256 public cumulativeTotalRewards;
    /**
     * track previous cumulative rewards for accounts
     * @notice this is not cumulated reward for address,
     * it is total cumulative total reward written, last time an update has been made for that address
     */
    mapping(address => uint256) public previousCumulatedRewards;

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
     * @dev Create Credit Line
     * @param _borrower Borrower address
     * @param _pool Pool to which the credit line is attached to
     * @param _principalDebt Initial amount of debt taken by borrower
     */
    constructor(
        address _borrower,
        ITrueFiPool2 _pool,
        uint256 _principalDebt
    ) public {
        ERC20.__ERC20_initialize("TrueFi Credit Line", "tfCL");

        borrower = _borrower;
        pool = _pool;

        principalDebt = _principalDebt;
        _mint(address(_pool), _principalDebt);
    }

    /**
     * @dev Update state of rewards
     */
    modifier update(address account) {
        // calculate total rewards
        uint256 newTotalInterestRewards = token().balanceOf(address(this)).add(totalClaimedRewards);
        // calculate new reward
        uint256 totalNewRewards = newTotalInterestRewards.sub(totalInterestRewards);
        // update interest rewards
        totalInterestRewards = newTotalInterestRewards;
        cumulativeTotalRewards = cumulativeTotalRewards.add(totalNewRewards);
        // update claimable reward for sender
        claimableRewards[account] = claimableRewards[account].add(
            balanceOf(account).mul(cumulativeTotalRewards.sub(previousCumulatedRewards[account])).div(totalSupply())
        );
        // update previous cumulative for sender
        previousCumulatedRewards[account] = cumulativeTotalRewards;
        _;
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
        // return claimable reward for this account
        // prettier-ignore
        return claimableRewards[account].add(
            balanceOf(account).mul(cumulativeTotalRewards.add(totalNewRewards).sub(previousCumulatedRewards[account])).div(totalSupply())
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
