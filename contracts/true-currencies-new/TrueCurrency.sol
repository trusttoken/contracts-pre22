// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {ProxyStorage} from "../trusttokens/ProxyStorage.sol";

abstract contract TrueCurrency is IERC20, ProxyStorage {}
