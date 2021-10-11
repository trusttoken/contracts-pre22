// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";
import {IERC20WithDecimals} from "./interface/IERC20WithDecimals.sol";
import {ILineOfCreditAgency} from "./interface/ILineOfCreditAgency.sol";
import {ILiquidator2} from "./interface/ILiquidator2.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {ICollateralVault} from "./interface/ICollateralVault.sol";

contract CollateralVault is ICollateralVault, UpgradeableClaimable {
    using SafeERC20 for IERC20WithDecimals;
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(address => uint256) public override stakedAmount;

    IERC20WithDecimals public override stakedToken;

    IBorrowingMutex public borrowingMutex;

    ILineOfCreditAgency public lineOfCreditAgency;

    ILiquidator2 public liquidator;

    // ======= STORAGE DECLARATION END ===========

    event Staked(address borrower, uint256 amount);

    event Unstaked(address borrower, uint256 amount);

    function initialize(
        IERC20WithDecimals _stakedToken,
        IBorrowingMutex _borrowingMutex,
        ILineOfCreditAgency _lineOfCreditAgency,
        ILiquidator2 _liquidator
    ) external initializer {
        UpgradeableClaimable.initialize(msg.sender);
        stakedToken = _stakedToken;
        borrowingMutex = _borrowingMutex;
        lineOfCreditAgency = _lineOfCreditAgency;
        liquidator = _liquidator;
    }

    function stake(uint256 amount) external {
        require(
            borrowingMutex.isUnlocked(msg.sender) || borrowingMutex.locker(msg.sender) == address(lineOfCreditAgency),
            "CollateralVault: Borrower can only stake when they're unlocked or have a line of credit"
        );
        stakedAmount[msg.sender] = stakedAmount[msg.sender].add(amount);
        stakedToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        require(canUnstake(msg.sender, amount), "CollateralVault: cannot unstake");

        stakedAmount[msg.sender] = stakedAmount[msg.sender].sub(amount);
        stakedToken.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }

    function slash(address borrower) external override {
        // require(msg.sender == liquidator)
        // require(borrowingMutex.isBanned(borrower))
        // transfer stakedAmount() to liquidator
        require(borrower == address(stakedToken)); // silence lint and build warnings
        revert("Unimplemented!");
    }

    function canUnstake(address borrower, uint256 amount) public view returns (bool) {
        if (amount > stakedAmount[borrower]) {
            return false;
        }
        if (borrowingMutex.isUnlocked(borrower)) {
            return true;
        }
        if (borrowingMutex.locker(borrower) != address(lineOfCreditAgency)) {
            return false;
        }
        return !lineOfCreditAgency.isOverProFormaLimit(borrower, stakedAmount[borrower].sub(amount));
    }
}
