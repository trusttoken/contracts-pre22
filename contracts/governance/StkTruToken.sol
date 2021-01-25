// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {VoteToken} from "./VoteToken.sol";
import {ClaimableContract} from "../trusttoken/common/ClaimableContract.sol";

contract StkTruToken is VoteToken, ClaimableContract, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant MIN_STAKE_TIME = 14 days;

    IERC20 public trustToken;
    IERC20 public tusd;
    uint256 public stakeApy;
    mapping(address => uint256) public unlockTime;

    event StakeApyChanged(uint256 newValue);

    function initialize(IERC20 _trustToken, IERC20 _tusd) public {
        require(!initalized, "StkTruToken: Already initialized");
        trustToken = _trustToken;
        tusd = _tusd;
        owner_ = msg.sender;
        initalized = true;
    }

    function setStakeApy(uint256 newStakeApy) external onlyOwner {
        stakeApy = newStakeApy;

        emit StakeApyChanged(newStakeApy);
    }

    function stake(uint256 amount, uint256 stakeTime) external {
        require(stakeTime >= MIN_STAKE_TIME, "StkTruToken: Stake time is too short");

        unlockTime[msg.sender] = block.timestamp + stakeTime;

        _mint(msg.sender, amount.mul(stakeApy.add(10000)).mul(stakeTime).div(365 days));
        require(trustToken.transferFrom(msg.sender, address(this), amount));
    }

    function unstake(uint256 amount) external nonReentrant {
        require(balanceOf[msg.sender] >= amount, "StkTruToken: Insufficient balance");
        require(unlockTime[msg.sender] <= block.timestamp, "StkTruToken: Stake is locked");

        uint256 truAmount = trustToken.balanceOf(address(this)).mul(amount).div(totalSupply);
        uint256 tusdAmount = tusd.balanceOf(address(this)).mul(amount).div(totalSupply);

        _burn(msg.sender, amount);

        require(trustToken.transfer(msg.sender, truAmount));
        require(tusd.transfer(msg.sender, tusdAmount));
    }

    function decimals() public override pure returns (uint8) {
        return 8;
    }

    function rounding() public pure returns (uint8) {
        return 8;
    }

    function name() public override pure returns (string memory) {
        return "Staked TrueFi";
    }

    function symbol() public override pure returns (string memory) {
        return "StkTRU";
    }
}
