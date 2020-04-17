pragma solidity ^0.5.13;

import { IERC20 } from "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract SimpleLiquidatorMock {
    IERC20 rewardToken;

    constructor(IERC20 _rewardToken) public {
        rewardToken = _rewardToken;
    }

    function reclaim(address _destination, int256 _debt) external {
        rewardToken.transfer(_destination, uint256(_debt));
    }
}