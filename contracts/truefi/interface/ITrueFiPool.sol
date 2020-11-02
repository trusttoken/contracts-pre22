// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {ICurve} from "./ICurve.sol";
import {IYToken} from "./IYToken.sol";

interface ITrueFiPool {
    function add_liquidity(uint256[4] memory amounts, uint256 min_mint_amount) external;

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        int128 i,
        uint256 min_amount,
        bool donate_dust
    ) external;

    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view returns (uint256);

    function token() external view returns (IERC20);

    function curve() external view returns (ICurve);

    function coins(int128 id) external view returns (IYToken);
}
