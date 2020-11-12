pragma solidity 0.6.10;

import {ICurveGauge, ICurveMinter} from "../interface/ICurve.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// prettier-ignore
contract MockCurveMinter is ICurveMinter {
    function mint(address gauge) external override {

    }

    function token() external override view returns (IERC20) {
        return IERC20(address(0));
    }
}

// prettier-ignore
contract MockCurveGauge is ICurveGauge {
    function balanceOf(address depositor) external override view returns (uint256) {

    }

    function minter() external override returns (ICurveMinter) {
        return ICurveMinter(address(0));
    }

    function deposit(uint256 amount) external override {

    }

    function withdraw(uint256 amount) external override {

    }
}
