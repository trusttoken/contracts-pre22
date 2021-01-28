// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {VoteToken} from "./VoteToken.sol";
import {ClaimableContract} from "../trusttoken/common/ClaimableContract.sol";
import {ITruPriceOracle} from "./interface/ITruPriceOracle.sol";
import {ITrueDistributor} from "../truefi/interface/ITrueDistributor.sol";

contract StkTruToken is VoteToken, ClaimableContract, ReentrancyGuard {
    using SafeMath for uint256;

    uint256 public constant MIN_STAKE_TIME = 14 days;

    IERC20 public tru;
    IERC20 public tfusd;
    ITruPriceOracle public oracle;
    ITrueDistributor public distributor;

    mapping(address => uint256) public unlockTime;

    event OracleChanged(ITruPriceOracle newOracle);
    event Stake(address indexed staker, uint256 amount, uint256 minted);
    event Unstake(address indexed staker, uint256 burntAmount, uint256 truAmount, uint256 tfusdAmount);

    function initialize(
        IERC20 _tru,
        IERC20 _tfusd,
        ITruPriceOracle _oracle,
        ITrueDistributor _distributor
    ) public {
        require(!initalized, "StkTruToken: Already initialized");
        tru = _tru;
        tfusd = _tfusd;
        oracle = _oracle;
        distributor = _distributor;
        owner_ = msg.sender;
        initalized = true;
    }

    function setOracle(ITruPriceOracle _oracle) external onlyOwner {
        oracle = _oracle;
        emit OracleChanged(_oracle);
    }

    function stake(uint256 amount) external {
        unlockTime[msg.sender] = nextUnlockTime();

        distributor.distribute();

        uint256 amountToMint = totalSupply == 0 ? amount : totalSupply.mul(amount).div(value());
        _mint(msg.sender, amountToMint);

        require(tru.transferFrom(msg.sender, address(this), amount));

        emit Stake(msg.sender, amount, amountToMint);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(balanceOf[msg.sender] >= amount, "StkTruToken: Insufficient balance");
        require(unlockTime[msg.sender] <= block.timestamp, "StkTruToken: Stake is locked");

        distributor.distribute();

        uint256 truAmount = tru.balanceOf(address(this)).mul(amount).div(totalSupply);
        uint256 tfusdAmount = tfusd.balanceOf(address(this)).mul(amount).div(totalSupply);

        _burn(msg.sender, amount);

        require(tru.transfer(msg.sender, truAmount));
        require(tfusd.transfer(msg.sender, tfusdAmount));

        emit Unstake(msg.sender, amount, truAmount, tfusdAmount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        unlockTime[recipient] = nextUnlockTime();
        _transfer(sender, recipient, amount);
    }

    function value() public view returns (uint256) {
        return tru.balanceOf(address(this)).add(oracle.usdToTru(tfusd.balanceOf(address(this))));
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
        return "stkTRU";
    }

    function nextUnlockTime() internal view returns (uint256) {
        return block.timestamp + MIN_STAKE_TIME;
    }
}
