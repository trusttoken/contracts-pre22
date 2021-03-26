// SPDX-License-Identifier: MIT

pragma solidity 0.6.10;

/**
 * @dev interface to allow standard pause function
 */
interface IPauseableContract {
    function setPauseStatus(bool pauseStatus) external;
}
