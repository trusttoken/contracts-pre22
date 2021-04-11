// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {I1Inch3} from "../interface/I1Inch3.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

library OneInchExchange {
    /**
     * @dev Forward data to 1Inch contract
     * @param _1inchExchange address of 1Inch (currently 0x11111112542d85b3ef69ae05771c2dccff4faa26 for mainnet)
     * @param data Data that is forwarded into the 1inch exchange contract. Can be acquired from 1Inch API https://api.1inch.exchange/v3.0/1/swap
     * [See more](https://docs.1inch.exchange/api/quote-swap#swap)
     *
     * @return description - description of the swap
     */
    function exchange(I1Inch3 _1inchExchange, bytes calldata data) internal returns (I1Inch3.SwapDescription memory description) {
        (, description, ) = abi.decode(data[4:], (address, I1Inch3.SwapDescription, bytes));

        IERC20(description.srcToken).approve(address(_1inchExchange), description.amount);

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, ) = address(_1inchExchange).call(data);
        if (!success) {
            // Revert with original error message
            assembly {
                let ptr := mload(0x40)
                let size := returndatasize()
                returndatacopy(ptr, 0, size)
                revert(ptr, size)
            }
        }
    }
}
