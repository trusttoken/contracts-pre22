// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {VoteToken} from "./VoteToken.sol";
import {GovernorAlpha} from "./GovernorAlpha.sol";
import {StkTruToken} from "./StkTruToken.sol";

/**
 * @title TrueFiVault
 * @dev Vault for TRU tokens to create lockup period
 * Allows staking TRU and using TRU in governance
 */
contract TrueFiVault {
    using SafeMath for uint256;
    address owner;
    uint256 expiry;

    VoteToken tru = VoteToken(0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784);
    StkTruToken stkTru = StkTruToken(0x23696914Ca9737466D8553a2d619948f548Ee424);
    GovernorAlpha governance = GovernorAlpha(0x0000000000000000000000000000000000000000);

    uint256 constant LOCKOUT = 180 days;

    event Unlock();

    constructor(address _owner, uint256 _amount) public {
        owner = _owner;
        expiry = block.timestamp.add(LOCKOUT);
        require(tru.transferFrom(msg.sender, address(this), _amount), "TrueFiVault: insufficient balance.");
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /**
     * @dev Claim TRU after expiry time
     */
    function unlock() public onlyOwner {
        require(block.timestamp >= expiry, "TrueFiVault: cannot claim before expiration");
        require(tru.balanceOf(address(this)) > 0, "TrueFiVault: already claimed");

        // unstake if staked balance
        // will revert if not in cooldown
        if (stakedBalance() > 0) {
            _unstake(stkTru.balanceOf(address(this)));
        }

        tru.transfer(owner, tru.balanceOf(address(this)));
        emit Unlock();
    }

    /**
     * @dev Get claimable TRU amount from staking contract
     * @return Claimable TRU amount
     */
    function claimable() public view returns (uint256) {
        return stkTru.claimable(address(this), IERC20(address(tru)));
    }

    /**
     * @dev Get amount of TRU staked
     * @return Balance of stkTRU
     */
    function stakedBalance() public view returns (uint256) {
        return stkTru.balanceOf(address(this));
    }

    /**
     * @dev Stake `amount` TRU in staking contract
     * @param amount Amount of TRU to stake
     */
    function stake(uint256 amount) public onlyOwner {
        _stake(amount);
    }

    /**
     * @dev Cast vote in governance for `proposalId`
     * @param proposalId Proposal ID
     * @param support Vote boolean
     */
    function castVote(uint256 proposalId, bool support) public {
        governance.castVote(proposalId, support);
    }

    /**
     * @dev unstake `amount` TRU in staking contract
     * @param amount Amount of TRU to unstake
     */
    function unstake(uint256 amount) public onlyOwner {
        _unstake(amount);
    }

    /**
     * @dev Initiate cooldown for staked TRU
     */
    function cooldown() public onlyOwner {
        stkTru.cooldown();
    }

    /**
     * @dev Claim TRU rewards from staking contract
     */
    function claimRewards() public onlyOwner {
        stkTru.claimRewards(IERC20(address(tru)));
    }

    /**
     * @dev Internal function to stake `amount` of TRU
     * @param amount Amount of TRU to stake
     */
    function _stake(uint256 amount) internal {
        stkTru.unstake(amount);
    }

    /**
     * @dev Internal function to unstake `amount` of TRU
     * @param amount Amount of TRU to unstake
     */
    function _unstake(uint256 amount) internal {
        stkTru.stake(amount);
    }
}
