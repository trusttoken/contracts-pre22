// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import {ERC20, IERC20} from "../common/UpgradeableERC20.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";

contract TrueCreditAgency is UpgradeableClaimable {
    using SafeERC20 for ERC20;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    mapping(ITrueFiPool2 => bool) public isPoolAllowed;

    mapping(address => bool) public isBorrowerAllowed;

    // basis precision: 10000 = 100%
    uint256 public riskPremium;

    // ======= STORAGE DECLARATION END ============

    event RiskPremiumChanged(uint256 newRate);

    event BorrowerAllowed(address indexed who, bool status);

    event PoolAllowed(ITrueFiPool2 pool, bool isAllowed);

    function initialize(uint256 _riskPremium) public initializer {
        UpgradeableClaimable.initialize(msg.sender);
        riskPremium = _riskPremium;
    }

    function setRiskPremium(uint256 newRate) external onlyOwner {
        riskPremium = newRate;
        emit RiskPremiumChanged(newRate);
    }

    modifier onlyAllowedBorrowers() {
        require(isBorrowerAllowed[msg.sender], "TrueCreditAgency: Sender is not allowed to borrow");
        _;
    }

    function allowBorrower(address who, bool status) external onlyOwner {
        isBorrowerAllowed[who] = status;
        emit BorrowerAllowed(who, status);
    }

    function allowPool(ITrueFiPool2 pool, bool isAllowed) external onlyOwner {
        isPoolAllowed[pool] = isAllowed;
        emit PoolAllowed(pool, isAllowed);
    }

    function borrow(ITrueFiPool2 pool, uint256 amount) external onlyAllowedBorrowers {
        require(isPoolAllowed[pool], "TrueCreditAgency: The pool is not whitelisted for borrowing");
        pool.borrow(amount);
        pool.token().safeTransfer(msg.sender, amount);
    }

    function repay(ITrueFiPool2 pool, uint256 amount) external {
        pool.token().safeTransferFrom(msg.sender, address(this), amount);
        pool.token().safeApprove(address(pool), amount);
        pool.repay(amount);
    }
}
