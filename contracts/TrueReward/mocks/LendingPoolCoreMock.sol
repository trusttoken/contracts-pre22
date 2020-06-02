pragma solidity 0.5.13;

import "../ILendingPoolCore.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract LendingPoolCoreMock is ILendingPoolCore {
    uint256 reserveNormalizedIncome = 1*10**27;

    function getReserveNormalizedIncome(address _reserve) external view returns (uint256) {
        return reserveNormalizedIncome;
    }

    function setReserveNormalizedIncome(uint256 value) external returns (uint256) {
        reserveNormalizedIncome = value;
    }

    function transferToReserve(address _reserve, address payable _user, uint256 _amount) external {
        require(ERC20(_reserve).transferFrom(_user, address(this), _amount), "LendingPoolCoreMock/transferToReserve");
    }
}
