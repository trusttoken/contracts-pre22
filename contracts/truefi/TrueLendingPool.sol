// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {ITrueFiPool} from "./ITrueFiPool.sol";

contract TrueLendingPool is Ownable {
    using SafeMath for uint256;

    mapping(address => bool) public whitelisted;
    ITrueFiPool public immutable pool;

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

    constructor(ITrueFiPool _pool) public {
        pool = _pool;
        _pool.token().approve(address(_pool), uint256(-1));
    }

    function setLoanBounds(uint256 min, uint256 max) external onlyOwner {
        require(max >= min, "maximum loan size smaller than minimal");
        minLoanSize = min;
        maxLoanSize = max;
        emit LoanBoundsChanged(min, max);
    }

    function setMinApy(uint256 newMinApy) external onlyOwner {
        minApy = newMinApy;
        emit MinApyChanged(newMinApy);
    }

    function setLoanApprovalConditions(uint256 newMinLoanApprovalFactor, uint256 newMinLoanApprovalVoteRatio) external onlyOwner {
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
}
