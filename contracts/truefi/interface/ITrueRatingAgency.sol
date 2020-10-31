// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

interface ITrueRatingAgency {
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

    function yes(address id, uint256 stake) external;

    function no(address id, uint256 stake) external;

    function withdraw(address id, uint256 stake) external;

    function claim(address id, address voter) external;
}
