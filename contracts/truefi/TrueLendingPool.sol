// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITrueFiPool} from "./ITrueFiPool.sol";

contract TrueLendingPool is Ownable {
    using SafeMath for uint256;

    struct Application {
        uint256 creationBlock;
        uint256 timestamp;
        address creator;
        address receiver;
        uint256 amount;
        uint256 apy;
        uint256 duration;
    }

    mapping(address => bool) public whitelisted;
    ITrueFiPool public immutable pool;
    mapping(bytes8 => Application) public applications;

    // ===== Pool parameters =====
    uint256 public minLoanSize = 1000000 ether;
    uint256 public maxLoanSize = 10000000 ether;
    /**
     * @notice Minimal APY for a loan
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public minApy = 1000;
    /**
     * @notice Minimum TRU voted YES required to approve a loan:
     * Loan size in TUSD * factor -> initial factor is 0.7
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public minLoanApprovalFactor = 7000;
    /**
     * @notice Minimum ratio YES votes required to pass
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public minLoanApprovalVoteRatio = 7000;
    /**
     * @notice How many TRU tokens are burnt for yes-voters in case loan defaults
     * @dev % multiplied by 100. e.g. 10.5% = 1050
     */
    uint256 public burnFactor = 8000;

    event Whitelisted(address indexed who, bool status);
    event LoanBoundsChanged(uint256 minLoanSize, uint256 maxLoanSize);
    event MinApyChanged(uint256 minApy);
    event LoanApprovalConditionsChanged(uint256 minLoanApprovalFactor, uint256 minLoanApprovalVoteRatio);
    event BurnFactorChanged(uint256 burnFactor);
    event NewApplication(bytes8 id, address creator, address receiver, uint256 amount, uint256 apy, uint256 duration);
    event ApplicationRemoved(bytes32 id);

    modifier onlyWhitelisted() {
        require(whitelisted[msg.sender], "TrueLendingPool: sender not whitelisted");
        _;
    }

    constructor(ITrueFiPool _pool) public {
        pool = _pool;
        _pool.token().approve(address(_pool), uint256(-1));
    }

    function setLoanBounds(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "TrueLendingPool: Maximal loan size is smaller than minimal");
        minLoanSize = min;
        maxLoanSize = max;
        emit LoanBoundsChanged(min, max);
    }

    function setMinApy(uint256 newMinApy) external onlyOwner {
        minApy = newMinApy;
        emit MinApyChanged(newMinApy);
    }

    function setLoanApprovalConditions(uint256 newMinLoanApprovalFactor, uint256 newMinLoanApprovalVoteRatio) external onlyOwner {
        require(newMinLoanApprovalFactor <= 10000, "TrueLendingPool: MinLoanApprovalFactor exceeds 100%");
        require(newMinLoanApprovalVoteRatio <= 10000, "TrueLendingPool: MinLoanApprovalVoteRatio exceeds 100%");

        minLoanApprovalFactor = newMinLoanApprovalFactor;
        minLoanApprovalVoteRatio = newMinLoanApprovalVoteRatio;
        emit LoanApprovalConditionsChanged(newMinLoanApprovalFactor, newMinLoanApprovalVoteRatio);
    }

    function setBurnFactor(uint256 newBurnFactor) external onlyOwner {
        burnFactor = newBurnFactor;
        emit BurnFactorChanged(newBurnFactor);
    }

    function whitelistForLoan(address who, bool status) external onlyOwner {
        whitelisted[who] = status;
        emit Whitelisted(who, status);
    }

    function createLoanApplication(
        address receiver,
        uint256 amount,
        uint256 apy,
        uint256 duration
    ) external onlyWhitelisted {
        require(amount >= minLoanSize && amount <= maxLoanSize, "TrueLendingPool: Loan size is out of bounds");
        require(apy >= minApy, "TrueLendingPool: APY is below minimum");

        bytes8 id = bytes8(uint64(uint256(keccak256(abi.encodePacked(msg.sender, receiver, block.number, amount, apy, duration)))));
        require(applications[id].creationBlock == 0, "TrueLendingPool: Cannot create two same applications in a single block");

        applications[id] = Application({
            creationBlock: block.number,
            timestamp: block.timestamp,
            creator: msg.sender,
            receiver: receiver,
            amount: amount,
            apy: apy,
            duration: duration
        });
        emit NewApplication(id, msg.sender, receiver, amount, apy, duration);
    }

    function removeLoanApplication(bytes8 id) external {
        require(applications[id].creationBlock != 0, "TrueLendingPool: application doesn't exist");
        require(applications[id].creator == msg.sender, "TrueLendingPool: not application's creator");
        delete applications[id];

        emit ApplicationRemoved(id);
    }
}
