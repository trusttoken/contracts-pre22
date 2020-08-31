// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ICurve {
    function calc_token_amount(uint256[4] memory amounts, bool deposit) external view returns (uint256);
}

interface ICurvePool {
    function add_liquidity(uint256[4] memory amounts, uint256 min_mint_amount) external;

    function remove_liquidity_one_coin(
        uint256 _token_amount,
        uint128 i,
        uint256 min_amount
    ) external;

    function calc_withdraw_one_coin(uint256 _token_amount, int128 i) external view returns (uint256);

    function token() external view returns (IERC20);

    function curve() external view returns (ICurve);
}
