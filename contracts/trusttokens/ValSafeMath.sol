// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

/**
 * Forked subset of Openzeppelin SafeMath allowing custom underflow/overflow messages
 * Useful for debugging, replaceable with standard SafeMath
 */
library ValSafeMath {
    function add(uint256 a, uint256 b, string memory overflowMessage) internal pure returns (uint256 result) {
        result = a + b;
        require(result >= a, overflowMessage);
    }
    function sub(uint256 a, uint256 b, string memory underflowMessage) internal pure returns (uint256 result) {
        require(b <= a, underflowMessage);
        result = a - b;
    }
    function mul(uint256 a, uint256 b, string memory overflowMessage) internal pure returns (uint256 result) {
        if (a == 0) {
            return 0;
        }
        result = a * b;
        require(result / a == b, overflowMessage);
    }
    function div(uint256 a, uint256 b, string memory divideByZeroMessage) internal pure returns (uint256 result) {
        require(b > 0, divideByZeroMessage);
        result = a / b;
    }
}
