// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {VoteToken} from "./VoteToken.sol";
import {ClaimableContract} from "../trusttoken/common/ClaimableContract.sol";
import {ITruPriceOracle} from "./interface/ITruPriceOracle.sol";

contract StkTruToken is VoteToken, ClaimableContract, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant MIN_STAKE_TIME = 14 days;

    IERC20 public trustToken;
    IERC20 public tusd;
    ITruPriceOracle public oracle;
    mapping(address => uint256) public unlockTime;

    event OracleChanged(ITruPriceOracle newOracle);
    event Stake(address indexed staker, uint256 amount, uint256 minted);
    event Unstake(address indexed staker, uint256 burntAmount, uint256 truAmount, uint256 tusdAmount);

    function initialize(
        IERC20 _trustToken,
        IERC20 _tusd,
        ITruPriceOracle _oracle
    ) public {
        require(!initalized, "StkTruToken: Already initialized");
        trustToken = _trustToken;
        tusd = _tusd;
        oracle = _oracle;
        owner_ = msg.sender;
        initalized = true;
    }

    function setOracle(ITruPriceOracle _oracle) external onlyOwner {
        oracle = _oracle;
        emit OracleChanged(_oracle);
    }

    function stake(uint256 amount) external {
        unlockTime[msg.sender] = block.timestamp + MIN_STAKE_TIME;

        uint256 amountToMint = totalSupply == 0 ? amount : totalSupply.mul(amount).div(value());
        _mint(msg.sender, amountToMint);

        require(trustToken.transferFrom(msg.sender, address(this), amount));

        emit Stake(msg.sender, amount, amountToMint);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(balanceOf[msg.sender] >= amount, "StkTruToken: Insufficient balance");
        require(unlockTime[msg.sender] <= block.timestamp, "StkTruToken: Stake is locked");

        uint256 truAmount = trustToken.balanceOf(address(this)).mul(amount).div(totalSupply);
        uint256 tusdAmount = tusd.balanceOf(address(this)).mul(amount).div(totalSupply);

        _burn(msg.sender, amount);

        require(trustToken.transfer(msg.sender, truAmount));
        require(tusd.transfer(msg.sender, tusdAmount));

        emit Unstake(msg.sender, amount, truAmount, tusdAmount);
    }

    function value() public view returns (uint256) {
        return trustToken.balanceOf(address(this)).add(oracle.usdToTru(tusd.balanceOf(address(this))));
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
