// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {I1Inch3} from "../interface/I1Inch3.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface MintableErc20 is IERC20 {
    function mint(address _to, uint256 _value) external;
}

contract Mock1InchV3 is I1Inch3 {
    uint256 outputAmount;

    function setOutputAmount(uint256 amount) external {
        outputAmount = amount;
    }

    function swap(
        address,
        SwapDescription calldata description,
        bytes calldata
    )
        external
        override
        returns (
            uint256 returnAmount,
            uint256 gasLeft,
            uint256 chiSpent
        )
    {
        IERC20(description.srcToken).transferFrom(msg.sender, address(this), description.amount);
        MintableErc20(description.dstToken).mint(msg.sender, outputAmount);
        return (outputAmount, 0, 0);
    }

    function unoswap(
        address,
        uint256,
        uint256,
        bytes32[] calldata
    ) external override payable returns (uint256) {
        return 0;
    }
}
