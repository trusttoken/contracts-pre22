pragma solidity ^0.5.13;


import "@trusttoken/trusttokens/contracts/Liquidator.sol";

contract LiquidatorMock is Liquidator {
    address mockPool;
    Registry mockRegistry;
    IERC20 mockOutputToken;
    IERC20 mockStakeToken;
    UniswapV1 mockOutputUniswap;
    UniswapV1 mockStakeUniswap;
    constructor(Registry _registry, IERC20 _outputToken, IERC20 _stakeToken, UniswapV1 _outputUniswap, UniswapV1 _stakeUniswap) public {
        mockRegistry = _registry;
        mockOutputToken = _outputToken;
        mockStakeToken = _stakeToken;
        mockOutputUniswap = _outputUniswap;
        mockStakeUniswap = _stakeUniswap;
        initialize();
    }
    function setPool(address _pool) external onlyOwner {
        mockPool = _pool;
    }
    function pool() internal view returns (address pool_) {
        pool_ = mockPool;
    }
    function outputToken() internal view returns (IERC20 outputToken_) {
        outputToken_ = mockOutputToken;
    }
    function stakeToken() internal view returns (IERC20 stakeToken_) {
        stakeToken_ = mockStakeToken;
    }
    function registry() internal view returns (Registry registry_) {
        registry_ = mockRegistry;
    }
    function outputUniswapV1() internal view returns (UniswapV1 outputUniswapV1_) {
        outputUniswapV1_ = mockOutputUniswap;
    }
    function stakeUniswapV1() internal view returns (UniswapV1 stakeUniswapV1_) {
        stakeUniswapV1_ = mockStakeUniswap;
    }
}
