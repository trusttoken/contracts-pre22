// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IBorrowingMutex} from "./interface/IBorrowingMutex.sol";
import {ICreditModel} from "./interface/ICreditModel.sol";
import {IERC20WithDecimals} from "./interface/IERC20WithDecimals.sol";
import {ILineOfCreditAgency} from "./interface/ILineOfCreditAgency.sol";
import {ILiquidator2} from "./interface/ILiquidator2.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

import {ICollateralVault} from "./interface/ICollateralVault.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

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
            "CollateralVault: Borrower cannot stake when they have an ongoing fixed term loan"
        );
        stakedToken.safeTransferFrom(msg.sender, address(this), amount);
        stakedAmount[msg.sender] = stakedAmount[msg.sender].add(amount);
    }

    function unstake(uint256 amount) external {
        // require(amount <= unstakeableAmount(borrower))
        // if borrowingMutex.locker(borrower) == LOCA:
        //   poke LOCA for borrower to update limit + rate
        // safe transfer amount to borrower
        require(amount == 0); // silence lint
        stakedToken = IERC20WithDecimals(address(0)); // silence build warning
        revert("Unimplemented!");
    }

    function slash(address borrower) external override {
        // require(msg.sender == liquidator)
        // require(borrowingMutex.isBanned(borrower))
        // transfer stakedAmount() to liquidator
        require(borrower == address(stakedToken)); // silence lint and build warnings
        revert("Unimplemented!");
    }

    function unstakeableAmount(address borrower) external view returns (uint256) {
        // if borrowingMutex.isUnlocked(borrower):
        //   return stakedAmount()
        // else if borrowingMutex.locker(borrower) == LOCA:
        //   return stakedAmount() - {TODO calculate minimum collateral from LOCA's borrow limit}
        // else:
        //   return 0
        require(borrower == address(stakedToken)); // silence lint and build warnings
        revert("Unimplemented!");
    }
}
