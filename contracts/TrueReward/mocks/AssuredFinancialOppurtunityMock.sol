pragma solidity ^0.5.13;

import "../AssuredFinancialOpportunity.sol";

contract AssuredFinancialOpportunityMock is AssuredFinancialOpportunity {

    // todo feewet: either add a constructor
    address opportunityAddress_ = 0x151B0E171A7fe3dB4d7B62FdB9Da6eBD1f5167bd;
    address assuranceAddress_ = 0x151B0E171A7fe3dB4d7B62FdB9Da6eBD1f5167bd;
    address liquidatorAddress_ = 0x151B0E171A7fe3dB4d7B62FdB9Da6eBD1f5167bd;

    constructor() public {
    	owner = msg.sender;
        opportunityAddress = opportunityAddress_;
        assuranceAddress = assuranceAddress_;
        liquidatorAddress = liquidatorAddress_;
        //super(opportunityAddress_, assuranceAddress_, liquidatorAddress_);
    }
}
