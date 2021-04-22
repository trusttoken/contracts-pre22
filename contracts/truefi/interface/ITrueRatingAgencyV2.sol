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

    function submit(address id) external;

    function retract(address id) external;

    function resetCastRatings(address id) external;

    function yes(address id) external;

    function no(address id) external;

    function claim(address id, address voter) external;
}
