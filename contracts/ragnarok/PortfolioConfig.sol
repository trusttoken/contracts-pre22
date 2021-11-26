// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {Ownable} from "@openzeppelin/contracts4/access/Ownable.sol";
import {BP, BPMath} from "./types/BP.sol";

contract PortfolioConfig is Ownable {
    using BPMath for BP;

    BP public protocolFee;
    address public protocolAddress;

    event ProtocolFeeChanged(BP newProtocolFee);
    event ProtocolAddressChanged(address newProtocolAddress);

    constructor(BP _protocolFee, address _protocolAddress) {
        protocolFee = _protocolFee;
        protocolAddress = _protocolAddress;
    }

    function setProtocolFee(BP newFee) public onlyOwner {
        protocolFee = newFee;
        emit ProtocolFeeChanged(newFee);
    }

    function setProtocolAddress(address newProtocolAddress) public onlyOwner {
        protocolAddress = newProtocolAddress;
        emit ProtocolAddressChanged(newProtocolAddress);
    }
}
