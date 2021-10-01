// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueRatingAgencyV2 {
    function getResults(address id)
        external
        view
        returns (
            uint256,
            uint256,
            uint256
        );

    function claim(address id, address voter) external;
}
