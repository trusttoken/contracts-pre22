// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable as Claimable} from "../common/UpgradeableClaimable.sol";

import {ITrueStrategy} from "./interface/ITrueStrategy.sol";
import {ITrueFiPool2, ITrueFiPoolOracle, I1Inch3} from "./interface/ITrueFiPool2.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";

import {ABDKMath64x64} from "../truefi/Log.sol";
import {OneInchExchange} from "./libraries/OneInchExchange.sol";

/**
 * @title TrueFiPool2
 * @dev Lending pool which may use a strategy to store idle funds
 * Earn high interest rates on currency deposits through uncollateralized loans
 *
 * Funds deposited in this pool are not fully liquid. Liquidity
 * Exiting the pool has 2 options:
 * - withdraw a basket of LoanTokens backing the pool
 * - take an exit penalty depending on pool liquidity
 * After exiting, an account will need to wait for LoanTokens to expire and burn them
 * It is recommended to perform a zap or swap tokens on Uniswap for increased liquidity
 *
 * Funds are managed through an external function to save gas on deposits
 */
contract TrueFiPool2 is ITrueFiPool2, ERC20, Claimable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using OneInchExchange for I1Inch3;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    uint8 public constant VERSION = 0;

    IERC20 public override token;

    ITrueStrategy public strategy;
    ITrueLender2 public lender;

    // fee for deposits
    uint256 public joiningFee;
    // track claimable fees
    uint256 public claimableFees;

    mapping(address => uint256) latestJoinBlock;

    IERC20 public liquidationToken;

    ITrueFiPoolOracle public override oracle;

    // allow pausing of deposits
    bool public isJoiningPaused;

    // cache values during sync for gas optimization
    bool private inSync;
    uint256 private strategyValueCache;
    uint256 private loansValueCache;

    // who gets all fees
    address public beneficiary;

    I1Inch3 public _1Inch;

    // ======= STORAGE DECLARATION END ===========

    // tolerance difference (percents) between
    // expected and actual transaction results
    // when dealing with strategies
    // and slippage on liquidation token price estimation
    uint8 public constant TOLERATED_SLIPPAGE = 4;

    function concat(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }

    function initialize(
        ERC20 _token,
        ERC20 _liquidationToken,
        ITrueLender2 _lender,
        I1Inch3 __1Inch,
        address __owner
    ) external override initializer {
        ERC20.__ERC20_initialize(concat("TrueFi ", _token.name()), concat("tf", _token.symbol()));
        Claimable.initialize(__owner);

        token = _token;
        liquidationToken = _liquidationToken;
        lender = _lender;
        _1Inch = __1Inch;
    }

    /**
     * @dev Emitted when fee is changed
     * @param newFee New fee
     */
    event JoiningFeeChanged(uint256 newFee);

    /**
     * @dev Emitted when beneficiary is changed
     * @param newBeneficiary New beneficiary
     */
    event BeneficiaryChanged(address newBeneficiary);

    /**
     * @dev Emitted when oracle is changed
     * @param newOracle New oracle
     */
    event OracleChanged(ITrueFiPoolOracle newOracle);

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
     */
    event Borrow(address borrower, uint256 amount);

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
     * @dev Emitted when strategy is switched
     * @param newStrategy Strategy to switch to
     */
    event StrategySwitched(ITrueStrategy newStrategy);

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
     * Sync values to avoid making expensive calls multiple times
     * Will set inSync to true, allowing getter functions to return cached values
     * Wipes cached values to save gas
     */
    modifier sync() {
        // sync
        strategyValueCache = strategyValue();
        loansValueCache = loansValue();
        inSync = true;
        _;
        // wipe
        inSync = false;
        strategyValueCache = 0;
        loansValueCache = 0;
    }

    /**
     * @dev Allow pausing of deposits in case of emergency
     * @param status New deposit status
     */
    function changeJoiningPauseStatus(bool status) external onlyOwner {
        isJoiningPaused = status;
        emit JoiningPauseStatusChanged(status);
    }

    /**
     * @dev Virtual value of liquid assets in the pool
     * @return Virtual liquid value of pool assets
     */
    function liquidValue() public view returns (uint256) {
        return currencyBalance().add(strategyValue());
    }

    /**
     * @dev Value of funds deposited into the strategy valuated in pool's token
     * @return Virtual value of strategy
     */
    function strategyValue() public view returns (uint256) {
        if (address(strategy) == address(0)) {
            return 0;
        }
        if (inSync) {
            return strategyValueCache;
        }
        return strategy.value();
    }

    /**
     * @dev Calculate pool value in TUSD
     * "virtual price" of entire pool - LoanTokens, TUSD, curve y pool tokens
     * @return pool value in USD
     */
    function poolValue() public view returns (uint256) {
        // this assumes defaulted loans are worth their full value
        return liquidValue().add(loansValue()).add(liquidationTokenValue());
    }

    /**
     * @dev Get total balance of stake tokens
     * @return Balance of stake tokens in this contract
     */
    function liquidationTokenBalance() public view returns (uint256) {
        return liquidationToken.balanceOf(address(this));
    }

    /**
     * @dev Price of TRU in USD
     * @return Oracle price of TRU in USD
     */
    function liquidationTokenValue() public view returns (uint256) {
        uint256 balance = liquidationTokenBalance();
        if (balance == 0 || address(oracle) == address(0)) {
            return 0;
        }
        // Use conservative price estimation to avoid pool being overvalued
        return withToleratedSlippage(oracle.truToToken(balance));
    }

    /**
     * @dev Virtual value of loan assets in the pool
     * Will return cached value if inSync
     * @return Value of loans in pool
     */
    function loansValue() public view returns (uint256) {
        if (inSync) {
            return loansValueCache;
        }
        return lender.value(this);
    }

    /**
     * @dev ensure enough tokens are available
     * Check if current available amount of TUSD is enough and
     * withdraw remainder from strategy
     * @param neededAmount amount required
     */
    function ensureSufficientLiquidity(uint256 neededAmount) internal {
        uint256 currentlyAvailableAmount = currencyBalance();
        if (currentlyAvailableAmount < neededAmount) {
            require(address(strategy) != address(0), "TrueFiPool: Pool has no strategy to withdraw from");
            strategy.withdraw(neededAmount.sub(currentlyAvailableAmount));
            require(currencyBalance() >= neededAmount, "TrueFiPool: Not enough funds taken from the strategy");
        }
    }

    /**
     * @dev set pool join fee
     * @param fee new fee
     */
    function setJoiningFee(uint256 fee) external onlyOwner {
        require(fee <= 10000, "TrueFiPool: Fee cannot exceed transaction value");
        joiningFee = fee;
        emit JoiningFeeChanged(fee);
    }

    /**
     * @dev set beneficiary
     * @param newBeneficiary new beneficiary
     */
    function setBeneficiary(address newBeneficiary) external onlyOwner {
        beneficiary = newBeneficiary;
        emit BeneficiaryChanged(newBeneficiary);
    }

    /**
     * @dev Join the pool by depositing tokens
     * @param amount amount of token to deposit
     */
    function join(uint256 amount) external override joiningNotPaused {
        uint256 fee = amount.mul(joiningFee).div(10000);
        uint256 mintedAmount = mint(amount.sub(fee));
        claimableFees = claimableFees.add(fee);

        latestJoinBlock[tx.origin] = block.number;
        token.safeTransferFrom(msg.sender, address(this), amount);

        emit Joined(msg.sender, amount, mintedAmount);
    }

    /**
     * @dev Exit pool
     * This function will withdraw a basket of currencies backing the pool value
     * @param amount amount of pool tokens to redeem for underlying tokens
     */
    function exit(uint256 amount) external {
        require(block.number != latestJoinBlock[tx.origin], "TrueFiPool: Cannot join and exit in same block");
        require(amount <= balanceOf(msg.sender), "TrueFiPool: Insufficient funds");

        uint256 _totalSupply = totalSupply();

        // get share of tokens kept in the pool
        uint256 liquidAmountToTransfer = amount.mul(liquidValue()).div(_totalSupply);

        // burn tokens sent
        _burn(msg.sender, amount);

        // withdraw basket of loan tokens
        lender.distribute(msg.sender, amount, _totalSupply);

        // if tokens remaining, transfer
        if (liquidAmountToTransfer > 0) {
            ensureSufficientLiquidity(liquidAmountToTransfer);
            token.safeTransfer(msg.sender, liquidAmountToTransfer);
        }

        emit Exited(msg.sender, amount);
    }

    /**
     * @dev Exit pool only with liquid tokens
     * This function will withdraw TUSD but with a small penalty
     * Uses the sync() modifier to reduce gas costs of using curve
     * @param amount amount of pool tokens to redeem for underlying tokens
     */
    function liquidExit(uint256 amount) external sync {
        require(block.number != latestJoinBlock[tx.origin], "TrueFiPool: Cannot join and exit in same block");
        require(amount <= balanceOf(msg.sender), "TrueFiPool: Insufficient funds");

        uint256 amountToWithdraw = poolValue().mul(amount).div(totalSupply());
        amountToWithdraw = amountToWithdraw.mul(liquidExitPenalty(amountToWithdraw)).div(10000);
        require(amountToWithdraw <= liquidValue(), "TrueFiPool: Not enough liquidity in pool");

        // burn tokens sent
        _burn(msg.sender, amount);

        ensureSufficientLiquidity(amountToWithdraw);

        token.safeTransfer(msg.sender, amountToWithdraw);

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
            // When all liquid, don't penalize
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
        require(address(strategy) != address(0), "TrueFiPool: Pool has no strategy set up");
        require(amount <= currencyBalance(), "TrueFiPool: Insufficient currency balance");

        uint256 expectedMinStrategyValue = strategy.value().add(withToleratedSlippage(amount));
        token.approve(address(strategy), amount);
        strategy.deposit(amount);
        require(strategy.value() >= expectedMinStrategyValue, "TrueFiPool: Strategy value expected to be higher");
        emit Flushed(amount);
    }

    /**
     * @dev Remove liquidity from strategy
     * @param minTokenAmount minimum amount of tokens to withdraw
     */
    function pull(uint256 minTokenAmount) external onlyOwner {
        require(address(strategy) != address(0), "TrueFiPool: Pool has no strategy set up");

        uint256 expectedCurrencyBalance = currencyBalance().add(minTokenAmount);
        strategy.withdraw(minTokenAmount);
        require(currencyBalance() >= expectedCurrencyBalance, "TrueFiPool: Currency balance expected to be higher");

        emit Pulled(minTokenAmount);
    }

    /**
     * @dev Remove liquidity from curve if necessary and transfer to lender
     * @param amount amount for lender to withdraw
     */
    function borrow(uint256 amount) external override onlyLender {
        require(amount <= liquidValue(), "TrueFiPool: Insufficient liquidity");
        if (amount > 0) {
            ensureSufficientLiquidity(amount);
        }

        token.safeTransfer(msg.sender, amount);

        emit Borrow(msg.sender, amount);
    }

    /**
     * @dev repay debt by transferring tokens to the contract
     * @param currencyAmount amount to repay
     */
    function repay(uint256 currencyAmount) external override onlyLender {
        token.safeTransferFrom(msg.sender, address(this), currencyAmount);
        emit Repaid(msg.sender, currencyAmount);
    }

    /**
     * @dev Claim fees from the pool
     */
    function collectFees() external {
        require(beneficiary != address(0), "TrueFiPool: Beneficiary is not set");

        uint256 amount = claimableFees;
        claimableFees = 0;

        if (amount > 0) {
            token.safeTransfer(beneficiary, amount);
        }

        emit Collected(beneficiary, amount);
    }

    /**
     * @dev Switches current strategy to a new strategy
     * @param newStrategy strategy to switch to
     */
    function switchStrategy(ITrueStrategy newStrategy) external onlyOwner {
        require(strategy != newStrategy, "TrueFiPool: Cannot switch to the same strategy");

        ITrueStrategy previousStrategy = strategy;
        strategy = newStrategy;

        emit StrategySwitched(newStrategy);

        if (address(previousStrategy) != address(0)) {
            uint256 expectedMinCurrencyBalance = currencyBalance().add(withToleratedSlippage(previousStrategy.value()));
            previousStrategy.withdrawAll();
            require(currencyBalance() >= expectedMinCurrencyBalance, "TrueFiPool: All funds should be withdrawn to pool");
            require(previousStrategy.value() == 0, "TrueFiPool: Switched strategy should be depleted");
        }
    }

    /**
     * @dev Change oracle, can only be called by owner
     */
    function setOracle(ITrueFiPoolOracle newOracle) external onlyOwner {
        oracle = newOracle;
        emit OracleChanged(newOracle);
    }

    function sellLiquidationToken(bytes calldata data) external {
        uint256 balanceBefore = token.balanceOf(address(this));

        I1Inch3.SwapDescription memory swap = _1Inch.exchange(data);

        uint256 expectedGain = oracle.truToToken(swap.amount);

        uint256 balanceDiff = token.balanceOf(address(this)).sub(balanceBefore);
        require(balanceDiff >= withToleratedSlippage(expectedGain), "TrueFiPool: Not optimal exchange");

        require(swap.srcToken == address(liquidationToken), "TrueFiPool: Source token is not TRU");
        require(swap.dstToken == address(token), "TrueFiPool: Destination token is not TUSD");
        require(swap.dstReceiver == address(this), "TrueFiPool: Receiver is not pool");
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

    /**
     * @dev Decrease provided amount percentwise by error
     * @param amount Amount to decrease
     * @return Calculated value
     */
    function withToleratedSlippage(uint256 amount) internal pure returns (uint256) {
        return amount.mul(100 - TOLERATED_SLIPPAGE).div(100);
    }
}
