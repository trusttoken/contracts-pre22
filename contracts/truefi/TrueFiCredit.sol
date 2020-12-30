// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

// Credit Pool Interface
interface ITrueCreditPool {
    function value() external view returns (uint256);
    function tokenValue() external view returns (uint256);
    function liquid() external view returns (uint256);
    function borrow(uint256 amount) external;
    function repay(uint256 amount) external;
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
}

/**
 * TODO:
 * - make fees work
 * - add modifiers
 * - add minting/burning for TUSD
 * - liquid exits
 * - make ClaimableOwnable
 * - add ERC20 functions and make not abstract
 * - add warnings for proxy storage
 * 
 * QUESTIONS:
 * - How to calculate defi rate?
 * - How do we track interest via credit pool?
 * - Do we assume pool value increases as debt increses?
 * - Do we need to loop through credit lines & update every time
 *      someone deposits/withdraws?
 */
abstract contract TrueCreditPool is ERC20, ITrueCreditPool {
    using SafeMath for uint256;
    ITrueCredit credit;
    IERC20 tusd;
    uint256 fee;

    // return liquid USD for borrowing
    function liquid() public view override returns (uint256) {
        return tusd.balanceOf(address(this));
    }

    // calculate value of funds deposited in curve
    function curveValue() public view returns (uint256) {
        // TODO
        // return 0 for now
        return 0;
    }

    // get total value of pool in TUSD
    function value() public view override returns (uint256) {
        return curveValue().add(liquid());
    }

    // get token value in TUSD
    function tokenValue() public view override returns (uint256) {
        return value().div(totalSupply());
    }

    // 
    function borrow(uint256 amount) public override {
        // TODO
        // 1. check credit limit & whitelist & enough liquid
        // 2. update credit contract
        // 3. transfer funds
        // 4. update borrowed amount in credit contract
    }

    // repay TUSD to pool
    function repay(uint256 amount) public override {
        // TODO
        // 1. check credit limit & whitelist
        // 2. update in credit contract
        // 3. transfer funds
        // 4. update borrowed amount in credit contract
    }

    function deposit(uint256 amount) public override {
        // TODO
    }

    function withdraw(uint256 amount) public override {
        // TODO
    }
}

interface ITrueCredit {
    function rate(address borrower) external view returns (uint256);
    function limit(address borrower) external view returns (uint256);
    function balances(address borrower) external view returns (uint256);
    function add(address borrower, uint256 amount) external;
    function remove(address borrower, uint256 amount) external;
    function updateBorrower(address borrower) external; // might not need this
    function updateAll() external;
    function addLine(address borrower, uint256 risk) external;
    function freezeLine(address borrower) external;
}

/** 
 * New TrueFi credit contract models credit limit for borrowers
 * TODO:
 * - implement freezing credit lines
 * - store array of borrowers and implement updateAll
 * - add modifiers
 */
contract TrueCredit is ITrueCredit {
    using SafeMath for uint256;
    ITrueCreditPool pool;
    IERC20 tru;

    uint256 public maxCoreRate;

    // staking data
    mapping(address=>mapping(address=>uint256)) public stakes;
    mapping(address=>uint256) totalStaked;

    // borrower data
    mapping(address=>bool) public borrowers;    // whitelist
    mapping(address=>bool) public frozen;       // frozen borrowers
    mapping(address=>uint256) public override balances;  // debt
    mapping(address=>uint256) public risks;     // risk adjustment
    mapping(address=>uint256) public rates;     // last lending rate
    mapping(address=>uint256) public lastUpdates;

    uint256 constant PRECISION = 10**18;
    uint256 constant BIP = 10**13; // 0.0001 (.01%)
    // 1_000000000000000000 = 100% = 10**18
    // 0_000100000000000000 = .01% = 10**13
    uint256 constant TRU_PRECISION = 10**8;
    uint256 constant YEAR = 3600*24*365; // year in seconds

    function initialize(
        ITrueCreditPool _pool,
        IERC20 _tru
    ) public {
        pool = _pool;
        tru = _tru;
        maxCoreRate = BIP.mul(2000); // 20%
    }

    // update core rate (in bips)
    function setMaxCoreRate(uint256 newMaxCoreRate) public {
        maxCoreRate = newMaxCoreRate;
    }

    // update risk for a borrower
    function setRisk(address borrower, uint256 newRisk) public {
        risks[borrower] = newRisk;
    }

    // get rate for one borrower
    // this works!
    function rate(address borrower) public view override returns (uint256) {
        return coreRate().add(exposure(borrower)).add(risks[borrower]);
    }

    // returns credit limit in TUSD
    function limit(address borrower) public view override returns (uint256) {
        return totalStaked[borrower];
    }

    // Add new borrower with risk adjustment
    function addLine(address borrower, uint256 risk) public override {
        // TODO check this works
        borrowers[borrower] = true;
        risks[borrower] = risk;
        updateBorrower(borrower);
    }

    // Add new borrower with risk adjustment
    function freezeLine(address borrower) public override {
        frozen[borrower] = true;
    }

    // update borrower credit
    // update every time we change state
    function updateAll() public override {
        // TODO loop through borrowers and update rates
    }

    // 1. calculate new interest rate for borrower
    // 2. calculate marginal interest since last update
    // 3. add interest to borrower balance
    // 4. update last rate & last update timestamp
    function updateBorrower(address borrower) public override {
        // TODO make sure this works
        // calculate new rate
        uint256 previousRate = rates[borrower];
        uint256 newRate = rate(borrower);
        uint256 lastUpdate = lastUpdates[borrower];
        uint256 delta = block.timestamp.sub(lastUpdate);
        uint256 balance = balances[borrower];

        // calculate marginal interest since last update
        uint256 marginal = balance
            .mul(delta)
            .mul(previousRate)
            .div(YEAR).div(1000);

        // update balance, last rate, last update
        balances[borrower].add(marginal);
        rates[borrower] = newRate;
        lastUpdates[borrower] = block.timestamp;
    }

    // stake on borrower
    function add(address borrower, uint256 amount) public override {
        // TODO
        // 1. Transfer TRU to this contract
        // 2. Update stake for msg.sender
        // 3. Update borrower credit
    }

    // remove stake from borrower
    function remove(address borrower, uint256 amount) public override {
        // TODO
        // 1. Update stake for msg.sender
        // 2. Upate borrower credit
        // 3. Withdraw TRU from contract
    }

    // Get core rate
    // this works!
    function coreRate() public view returns (uint256) {
        uint256 newRate = defiRate().add(usage());
        if (newRate > maxCoreRate) {
            return maxCoreRate;
        }
        return newRate;
    }

    // calculate usage adjustment
    // this works!
    function usage() public view returns (uint256) {
        // usageAdj = coreRate * (1-liquidRate)
        uint256 ratio = PRECISION.sub(liquidRatio()); //35%

        uint256 use = (ratio    // 10**18
                .div(1e15)**15) // 10**45 * 10 ** 18  =  10 ** 53
                .div(1e27);     // (18-15)*15-18 = 27

        return maxCoreRate
            .mul(use)
            .div(PRECISION);
    }

    // get ratio of liquid funds to pool value
    // this works!
    function liquidRatio() public view returns (uint256) {
        // pool_liquid / pool_value
        return pool.liquid()
            .mul(PRECISION)
            .div(pool.value());
    }

    // get exposure for borrower
    // this works!
    function exposure(address borrower) public view returns (uint256) {
        uint256 EX_PRECISION = 1e5;

        // exposureFactor: 10**15 precision
        uint256 exposureFactor = EX_PRECISION
            .mul(balances[borrower])
                .div(limit(borrower)) // 10**5
            **3;

        // return 10**18 precision
        return risks[borrower]      // 10**18
            .mul(exposureFactor)    // 10**15
            .div(EX_PRECISION**3);  // 10**15
    }

    // current best rate from lending TUSD to defi
    // this poses a risk for borrowers since this amount is not exact
    function defiRate() public view returns (uint256) {
        // TODO: best way to calculate defiRate
        // for now return fixed number
        return BIP.mul(1300);
    }
}