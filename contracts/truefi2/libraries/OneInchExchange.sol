// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;
pragma experimental ABIEncoderV2;

import {I1Inch3} from "../interface/I1Inch3.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniRouter {
    function token0() external view returns (address);

    function token1() external view returns (address);
}

library OneInchExchange {
    uint256 constant ADDRESS_MASK = 0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff;
    uint256 constant REVERSE_MASK = 0x8000000000000000000000000000000000000000000000000000000000000000;

    /**
     * @dev Forward data to 1Inch contract
     * @param _1inchExchange address of 1Inch (currently 0x11111112542d85b3ef69ae05771c2dccff4faa26 for mainnet)
     * @param data Data that is forwarded into the 1inch exchange contract. Can be acquired from 1Inch API https://api.1inch.exchange/v3.0/1/swap
     * [See more](https://docs.1inch.exchange/api/quote-swap#swap)
     *
     * @return description - description of the swap
     */

    function exchange(I1Inch3 _1inchExchange, bytes calldata data) internal returns (I1Inch3.SwapDescription memory description) {
        if (data[0] == 0x7c) {
            // call `swap()`
            (, description, ) = abi.decode(data[4:], (address, I1Inch3.SwapDescription, bytes));
        } else {
            // call `unoswap()`
            (address srcToken, uint256 amount, uint256 minReturn, bytes32[] memory pathData) = abi.decode(
                data[4:],
                (address, uint256, uint256, bytes32[])
            );
            description.srcToken = srcToken;
            description.amount = amount;
            description.minReturnAmount = minReturn;
            description.flags = 0;
            uint256 lastPath = uint256(pathData[pathData.length - 1]);
            IUniRouter uniRouter = IUniRouter(address(lastPath & ADDRESS_MASK));
            bool isReverse = lastPath & REVERSE_MASK > 0;
            description.dstToken = isReverse ? uniRouter.token0() : uniRouter.token1();
            description.dstReceiver = address(this);
        }

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
