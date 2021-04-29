// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import "../truefi/interface/ICurve.sol";
import "hardhat/console.sol";

contract CrvBaseRateOracle {
    uint256 storedCrvBaseRate;
    uint256 storedTimestamp;
    ICurve public curve;

    using SafeMath for uint256;

    constructor(ICurve _curve) public {
        curve = _curve;
    }

    function updateRate() public {
        storedTimestamp = block.timestamp;
        storedCrvBaseRate = curve.get_virtual_price();
    }

    function getStoredData() public view returns (uint256, uint256) {
        return (storedCrvBaseRate, storedTimestamp);
    }

    function rate(uint256 forHowFarInFuture) public view returns (uint256) {
        require(storedTimestamp != 0 && storedCrvBaseRate != 0, "CrvBaseRateOracle: rateUpdate must be called at least once");
        uint256 curTimestamp = block.timestamp;
        uint256 curCrvBaseRate = curve.get_virtual_price();
        require(curCrvBaseRate >= storedCrvBaseRate, "CrvBaseRateOracle: rate function should be monotonically increasing");
        uint256 profitPercents = (curCrvBaseRate.sub(storedCrvBaseRate))
            .mul(forHowFarInFuture)
            .mul(10000)
            .div(curTimestamp.sub(storedTimestamp))
            .div(curCrvBaseRate);
        return profitPercents;
    }
}
