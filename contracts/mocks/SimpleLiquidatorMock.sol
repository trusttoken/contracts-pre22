import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../TrueReward/ILiquidator.sol";

contract SimpleLiquidatorMock is ILiquidator {
    IERC20 rewardToken;

    constructor(IERC20 _rewardToken) public {
        rewardToken = _rewardToken;
    }

    function reclaim(address _destination, int256 _debt) external {
        rewardToken.transfer(_destination, uint256(_debt));
    }
}
