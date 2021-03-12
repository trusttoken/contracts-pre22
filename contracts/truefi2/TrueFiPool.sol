// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ITrueStrategy} from "./interface/ITrueStrategy.sol";
import {ITrueLender} from "./interface/ITrueLender.sol";
import {ABDKMath64x64} from "../truefi/Log.sol";

/**
 * @title TrueFi Pool
 * @dev Lending pool which uses curve.fi to store idle funds
 * Earn high interest rates on currency deposits through uncollateralized loans
 *
 * Funds deposited in this pool are not fully liquid. Luqidity
 * Exiting the pool has 2 options:
 * - withdraw a basket of LoanTokens backing the pool
 * - take an exit penallty depending on pool liquidity
 * After exiting, an account will need to wait for LoanTokens to expire and burn them
 * It is recommended to perform a zap or swap tokens on Uniswap for increased liquidity
 *
 * Funds are managed through an external function to save gas on deposits
 */
contract TrueFiPool2 is ERC20, Ownable {
    using SafeMath for uint256;

    uint8 public constant VERSION = 0;

    IERC20 public token;

    ITrueStrategy public strategy;
    ITrueLender public lender;

    // fee for deposits
    uint256 public joiningFee;
    // track claimable fees
    uint256 public claimableFees;

    mapping(address => uint256) latestJoinBlock;

    IERC20 public _stakeToken;

    // allow pausing of deposits
    bool public isJoiningPaused;

    function concat(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    constructor(ERC20 _token) public ERC20(concat("TrueFi ", _token.name()), concat("tf", _token.symbol())) {}

    /**
     * @dev Emitted when someone joins the pool
     * @param staker Account staking
     * @param deposited Amount deposited
     * @param minted Amount of pool tokens minted
     */
    event Joined(address indexed staker, uint256 deposited, uint256 minted);

    /**
     * @dev Emitted when someone exits the pool
     * @param staker Account exiting
     * @param amount Amount unstaking
     */
    event Exited(address indexed staker, uint256 amount);

    /**
     * @dev Emitted when funds are flushed into curve.fi
     * @param currencyAmount Amount of tokens deposited
     */
    event Flushed(uint256 currencyAmount);

    /**
     * @dev Emitted when funds are pulled from curve.fi
     * @param yAmount Amount of pool tokens
     */
    event Pulled(uint256 yAmount);

    /**
     * @dev Emitted when funds are borrowed from pool
     * @param borrower Borrower address
     * @param amount Amount of funds borrowed from pool
     * @param fee Fees collected from this transaction
     */
    event Borrow(address borrower, uint256 amount, uint256 fee);

    /**
     * @dev Emitted when borrower repays the pool
     * @param payer Address of borrower
     * @param amount Amount repaid
     */
    event Repaid(address indexed payer, uint256 amount);

    /**
     * @dev Emitted when fees are collected
     * @param beneficiary Account to receive fees
     * @param amount Amount of fees collected
     */
    event Collected(address indexed beneficiary, uint256 amount);

    /**
     * @dev Emitted when joining is paused or unpaused
     * @param isJoiningPaused New pausing status
     */
    event JoiningPauseStatusChanged(bool isJoiningPaused);

    /**
     * @dev only lender can perform borrowing or repaying
     */
    modifier onlyLender() {
        require(msg.sender == address(lender), "TrueFiPool: Caller is not the lender");
        _;
    }

    /**
     * @dev pool can only be joined when it's unpaused
     */
    modifier joiningNotPaused() {
        require(!isJoiningPaused, "TrueFiPool: Joining the pool is paused");
        _;
    }

    /**
     * @dev Allow pausing of deposits in case of emergency
     * @param status New deposit status
     */
    function changeJoiningPauseStatus(bool status) external {
        isJoiningPaused = status;
        emit JoiningPauseStatusChanged(status);
    }

    /**
     * @dev Virtual value of liquid assets in the pool
     * @return Virtual liquid value of pool assets
     */
    function liquidValue() public view returns (uint256) {
        return currencyBalance().add(strategy.value());
    }

    /**
     * @dev Calculate pool value in TUSD
     * "virtual price" of entire pool - LoanTokens, TUSD, curve y pool tokens
     * @return pool value in USD
     */
    function poolValue() public view returns (uint256) {
        // this assumes defaulted loans are worth their full value
        return liquidValue().add(loansValue());
    }

    /**
     * @dev Virtual value of loan assets in the pool
     * Will return cached value if inSync
     * @return Value of loans in pool
     */
    function loansValue() public view returns (uint256) {
        return lender.value();
    }

    /**
     * @dev Join the pool by depositing currency tokens
     * @param amount amount of currency token to deposit
     */
    function join(uint256 amount) external joiningNotPaused {
        uint256 fee = amount.mul(joiningFee).div(10000);
        uint256 mintedAmount = mint(amount.sub(fee));
        claimableFees = claimableFees.add(fee);

        latestJoinBlock[tx.origin] = block.number;
        require(token.transferFrom(msg.sender, address(this), amount));

        emit Joined(msg.sender, amount, mintedAmount);
    }

    /**
     * @dev ensure enough tokens are available
     * Check if current available amount of TUSD is enough and
     * withdraw remainder from strategy
     * @param neededAmount amount required
     */
    function ensureEnoughTokensAreAvailable(uint256 neededAmount) internal {
        uint256 currentlyAvailableAmount = currencyBalance();
        if (currentlyAvailableAmount < neededAmount) {
            strategy.pullOut(neededAmount.sub(currentlyAvailableAmount));
            require(currencyBalance() >= neededAmount, "TrueFiPool: Not enough funds taken from the strategy");
        }
    }

    /**
     * @dev Exit pool
     * This function will withdraw a basket of currencies backing the pool value
     * @param amount amount of pool tokens to redeem for underlying tokens
     */
    function exit(uint256 amount) external {
        require(block.number != latestJoinBlock[tx.origin], "TrueFiPool: Cannot join and exit in same block");
        require(amount <= balanceOf(msg.sender), "TrueFiPool: insufficient funds");

        uint256 _totalSupply = totalSupply();

        // get share of currency tokens kept in the pool
        uint256 liquidAmountToTransfer = amount.mul(liquidValue()).div(_totalSupply);

        // burn tokens sent
        _burn(msg.sender, amount);

        // withdraw basket of loan tokens
        lender.distribute(msg.sender, amount, _totalSupply);

        // if currency remaining, transfer
        if (liquidAmountToTransfer > 0) {
            ensureEnoughTokensAreAvailable(liquidAmountToTransfer);
            require(token.transfer(msg.sender, liquidAmountToTransfer));
        }

        emit Exited(msg.sender, amount);
    }

    /**
     * @dev Exit pool only with liquid tokens
     * This function will withdraw TUSD but with a small penalty
     * Uses the sync() modifier to reduce gas costs of using curve
     * @param amount amount of pool tokens to redeem for underlying tokens
     */
    function liquidExit(uint256 amount) external {
        require(block.number != latestJoinBlock[tx.origin], "TrueFiPool: Cannot join and exit in same block");
        require(amount <= balanceOf(msg.sender), "TrueFiPool: Insufficient funds");

        uint256 amountToWithdraw = poolValue().mul(amount).div(totalSupply());
        amountToWithdraw = amountToWithdraw.mul(liquidExitPenalty(amountToWithdraw)).div(10000);
        require(amountToWithdraw <= liquidValue(), "TrueFiPool: Not enough liquidity in pool");

        // burn tokens sent
        _burn(msg.sender, amount);

        ensureEnoughTokensAreAvailable(amountToWithdraw);

        require(token.transfer(msg.sender, amountToWithdraw));

        emit Exited(msg.sender, amountToWithdraw);
    }

    /**
     * @dev Penalty (in % * 100) applied if liquid exit is performed with this amount
     * returns 10000 if no penalty
     */
    function liquidExitPenalty(uint256 amount) public view returns (uint256) {
        uint256 lv = liquidValue();
        uint256 pv = poolValue();
        if (amount == pv) {
            return 10000;
        }
        uint256 liquidRatioBefore = lv.mul(10000).div(pv);
        uint256 liquidRatioAfter = lv.sub(amount).mul(10000).div(pv.sub(amount));
        return uint256(10000).sub(averageExitPenalty(liquidRatioAfter, liquidRatioBefore));
    }

    /**
     * @dev Calculates integral of 5/(x+50)dx times 10000
     */
    function integrateAtPoint(uint256 x) public pure returns (uint256) {
        return uint256(ABDKMath64x64.ln(ABDKMath64x64.fromUInt(x.add(50)))).mul(50000).div(2**64);
    }

    /**
     * @dev Calculates average penalty on interval [from; to]
     * @return average exit penalty
     */
    function averageExitPenalty(uint256 from, uint256 to) public pure returns (uint256) {
        require(from <= to, "TrueFiPool: To precedes from");
        if (from == 10000) {
            // When all liquid, dont penalize
            return 0;
        }
        if (from == to) {
            return uint256(50000).div(from.add(50));
        }
        return integrateAtPoint(to).sub(integrateAtPoint(from)).div(to.sub(from));
    }

    /**
     * @dev Deposit idle funds into strategy
     * @param amount Amount of funds to deposit into curve
     */
    function flush(uint256 amount) external {
        require(amount <= currencyBalance(), "TrueFiPool: Insufficient currency balance");

        strategy.putIn(amount);

        emit Flushed(amount);
    }

    /**
     * @dev Remove liquidity from strategy
     * @param minTokenAmount minimum amount of tokens to withdraw
     */
    function pull(uint256 minTokenAmount) external onlyOwner {
        // unstake in gauge
        ensureEnoughTokensAreAvailable(minTokenAmount);

        strategy.pullOut(minTokenAmount);

        emit Pulled(minTokenAmount);
    }

    // prettier-ignore
    /**
     * @dev Remove liquidity from curve if necessary and transfer to lender
     * @param amount amount for lender to withdraw
     */
    function borrow(uint256 amount, uint256 fee) external  onlyLender {
        require(amount <= liquidValue(), "");
        if (amount > 0) {
            ensureEnoughTokensAreAvailable(amount);
        }

        mint(fee);
        require(token.transfer(msg.sender, amount.sub(fee)));

        emit Borrow(msg.sender, amount, fee);
    }

    /**
     * @dev repay debt by transferring tokens to the contract
     * @param currencyAmount amount to repay
     */
    function repay(uint256 currencyAmount) external onlyLender {
        require(token.transferFrom(msg.sender, address(this), currencyAmount));
        emit Repaid(msg.sender, currencyAmount);
    }

    /**
     * @dev Claim fees from the pool
     * @param beneficiary account to send funds to
     */
    function collectFees(address beneficiary) external onlyOwner {
        uint256 amount = claimableFees;
        claimableFees = 0;

        if (amount > 0) {
            require(token.transfer(beneficiary, amount));
        }

        emit Collected(beneficiary, amount);
    }

    /**
     * @dev Currency token balance
     * @return Currency token balance
     */
    function currencyBalance() internal view returns (uint256) {
        return token.balanceOf(address(this)).sub(claimableFees);
    }

    /**
     * @param depositedAmount Amount of currency deposited
     * @return amount minted from this transaction
     */
    function mint(uint256 depositedAmount) internal returns (uint256) {
        uint256 mintedAmount = depositedAmount;
        if (mintedAmount == 0) {
            return mintedAmount;
        }

        // first staker mints same amount deposited
        if (totalSupply() > 0) {
            mintedAmount = totalSupply().mul(depositedAmount).div(poolValue());
        }
        // mint pool tokens
        _mint(msg.sender, mintedAmount);

        return mintedAmount;
    }
}
