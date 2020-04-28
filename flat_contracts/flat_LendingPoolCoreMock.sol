
// File: contracts/TrueReward/ILendingPoolCore.sol

pragma solidity ^0.5.13;

interface ILendingPoolCore {
  function getReserveNormalizedIncome(address _reserve) external view returns (uint256);
}

// File: contracts/TrueReward/mocks/LendingPoolCoreMock.sol

pragma solidity ^0.5.13;


contract LendingPoolCoreMock is ILendingPoolCore {
    uint256 reserveNormalizedIncome = 1*10**27;

    function getReserveNormalizedIncome(address _reserve) external view returns (uint256) {
        return reserveNormalizedIncome;
    }

    function setReserveNormalizedIncome(uint256 value) external returns (uint256) {
        reserveNormalizedIncome = value;
    }
}
