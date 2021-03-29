// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

contract StringReturn {
    function reflect(string memory text) external pure returns (string memory) {
        return text;
    }
}
