// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {ITrueFiPool2} from "./ITrueFiPool2.sol";
import {ILoanToken} from "../../truefi/interface/ILoanToken.sol";

interface IContractWithPool {
    function pool() external view returns (ITrueFiPool2);
}

// Had to be split because of multiple inheritance problem
interface ILoanToken2 is ILoanToken, IContractWithPool {

}
