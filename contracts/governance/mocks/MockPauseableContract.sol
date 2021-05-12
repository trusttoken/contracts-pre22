// SPDX-License-Identifier: MIT

pragma solidity 0.6.10;

import {IPauseableContract} from "../../common/interface/IPauseableContract.sol";

contract MockPauseableContract is IPauseableContract {
    bool public pauseStatus;

    event PauseStatusChanged(bool pauseStatus);

    function setPauseStatus(bool status) external override {
        pauseStatus = status;
        emit PauseStatusChanged(status);
    }
}
