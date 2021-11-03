// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "../TrueFiPool2.sol";

contract TestTrueFiPool2 is TrueFiPool2 {
    function setLender(ITrueLender2Deprecated _lender) external onlyOwner {
        lender = _lender;
    }
}
