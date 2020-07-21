// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ILendingPool} from "../ILendingPool.sol";
import {ILendingPoolCore} from "../ILendingPoolCore.sol";
import {ATokenMock} from "./ATokenMock.sol";

contract LendingPoolMock is ILendingPool {
    ILendingPoolCore _core;
    ATokenMock aToken;

    constructor(ILendingPoolCore _lendingPoolCore, ATokenMock _aToken) public {
        _core = _lendingPoolCore;
        aToken = _aToken;
    }

    function deposit(
        address _reserve,
        uint256 _amount,
        uint16
    ) external override {
        IERC20 token = aToken.token();
        require(_reserve == address(token), "incorrect reserve");
        require(token.allowance(msg.sender, address(_core)) >= _amount, "not enough allowance");
        require(token.balanceOf(msg.sender) >= _amount, "not enough balance");
        _core.transferToReserve(address(token), msg.sender, _amount);
        aToken.mint(msg.sender, _amount);
    }

    function core() external override view returns (address) {
        return address(_core);
    }
}
