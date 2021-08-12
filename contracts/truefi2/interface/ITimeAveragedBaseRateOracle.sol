// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITimeAveragedBaseRateOracle {
    function calculateAverageAPY(uint16 numberOfValues) external view returns (uint256);

    function getWeeklyAPY() external view returns (uint256);

    function getMonthlyAPY() external view returns (uint256);

    function getYearlyAPY() external view returns (uint256);
}
