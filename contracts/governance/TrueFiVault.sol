// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {VoteToken} from "./VoteToken.sol";
import {GovernorAlpha} from "./GovernorAlpha.sol";
import {StkTruToken} from "./StkTruToken.sol";

/**
 * @title TrueFiVault
 * @dev Vault for granting TRU tokens from deployer to owner after a lockout period.
 *
 * After the lockout period, owner may withdraw any TRU in the vault.
 * During the lockout period, the vault still allows owner to stake TRU
 * and cast votes in governance.
 *
 * In case of emergency or error, deployer reserves the ability to withdraw all
 * funds in vault.
 */
contract TrueFiVault {
    using SafeMath for uint256;
    address owner;
    address deployer;
    uint256 expiry;

    VoteToken tru = VoteToken(0x4C19596f5aAfF459fA38B0f7eD92F11AE6543784);
    StkTruToken stkTru = StkTruToken(0x23696914Ca9737466D8553a2d619948f548Ee424);
    GovernorAlpha governance = GovernorAlpha(0x0000000000000000000000000000000000000000);

    uint256 constant LOCKOUT = 180 days;

    event WithdrawTo(address recipient);

    constructor(address _owner, uint256 _amount) public {
        owner = _owner;
        deployer = msg.sender;
        expiry = block.timestamp.add(LOCKOUT);
        require(tru.transferFrom(deployer, address(this), _amount), "TrueFiVault: insufficient balance.");
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /**
     * @dev Throws if called by any account other than the deployer.
     */
    modifier onlyDeployer() {
        require(msg.sender == deployer, "only deployer");
        _;
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
     * @dev Allow deployer to withdraw funds in case of emergency or mistake
     */
    function withdrawToDeployer() public onlyDeployer {
        _withdrawTo(deployer);
    }

    /**
     * @dev Withdraw funds to owner after expiry time
     */
    function withdrawToOwner() public onlyOwner {
        require(block.timestamp >= expiry, "TrueFiVault: owner cannot withdraw before expiration");
        _withdrawTo(owner);
    }

    /**
     * @dev Internal function to withdraw funds to recipient
     */
    function _withdrawTo(address recipient) private {
        tru.transfer(recipient, tru.balanceOf(address(this)));
        stkTru.transfer(recipient, stkTru.balanceOf(address(this)));
        emit WithdrawTo(recipient);
    }

    /**
     * @dev Cast vote in governance for `proposalId`
     * Uses both TRU and stkTRU balance
     * @param proposalId Proposal ID
     * @param support Vote boolean
     */
    function castVote(uint256 proposalId, bool support) public onlyOwner {
        governance.castVote(proposalId, support);
    }

    /**
     * @dev Stake `amount` TRU in staking contract
     * @param amount Amount of TRU to stake
     */
    function stake(uint256 amount) public onlyOwner {
        stkTru.stake(amount);
    }

    /**
     * @dev unstake `amount` TRU in staking contract
     * @param amount Amount of TRU to unstake
     */
    function unstake(uint256 amount) public onlyOwner {
        stkTru.unstake(amount);
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
}
