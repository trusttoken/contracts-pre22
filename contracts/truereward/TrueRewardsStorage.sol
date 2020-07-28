// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {FinancialOpportunity} from "./FinancialOpportunity.sol";

contract TrueRewardsStorage {
    FinancialOpportunity[] public financialOpportunities;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;

    IERC20 public trueRewardToken;
}
