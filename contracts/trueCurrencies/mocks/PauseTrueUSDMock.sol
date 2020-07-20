// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {PausedTrueUSD} from "../utilities/PausedCurrencies.sol";

contract PausedTrueUSDMock is PausedTrueUSD {
    address public delegateFrom;

    function setDelegateFrom(address _delegateFrom) external {
        delegateFrom = _delegateFrom;
    }

    modifier onlyDelegateFrom() override {
        require(msg.sender == delegateFrom);
        _;
    }
}
