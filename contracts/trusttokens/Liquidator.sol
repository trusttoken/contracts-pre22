// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

//pragma experimental ABIEncoderV2;

import "./ALiquidatorUniswap.sol";

/**
 * @title Liquidator
 * @dev Implementation of ALiquidator
**/
contract Liquidator is ALiquidatorUniswap {
    address pool_;
    Registry registry_;
    IERC20 outputToken_;
    IERC20 stakeToken_;
    UniswapV1 outputUniswap_;
    UniswapV1 stakeUniswap_;
    bool initialized;

    function configure(
        address registryAddress,
        address outputTokenAddress,
        address stakeTokenAddress,
        address outputUniswapAddress,
        address stakeUniswapAddress
    ) external {
        require(!initialized, "already initialized");
        registry_ = Registry(registryAddress);
        outputToken_ = IERC20(outputTokenAddress);
        stakeToken_ = IERC20(stakeTokenAddress);
        outputUniswap_ = UniswapV1(outputUniswapAddress);
        stakeUniswap_ = UniswapV1(stakeUniswapAddress);
        owner = msg.sender;
        emit OwnershipTransferred(address(0), owner);
        initialized = true;
        initialize();
    }
    function setPool(address _pool) external onlyOwner {
        pool_ = _pool;
    }
    function pool() public override view returns (address) {
        return pool_;
    }
    function outputToken() public override view returns (IERC20) {
        return outputToken_;
    }
    function stakeToken() public override view returns (IERC20) {
        return stakeToken_;
    }
    function registry() public override view returns (Registry) {
        return registry_;
    }
    function outputUniswapV1() public override view returns (UniswapV1) {
        return outputUniswap_;
    }
    function stakeUniswapV1() public override view returns (UniswapV1) {
        return stakeUniswap_;
    }
}
