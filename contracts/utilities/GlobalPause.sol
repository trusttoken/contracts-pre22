pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Claimable.sol";

/*
All future trusttoken tokens can reference this contract. 
Allow for Admin to pause a set of tokens with one transaction
Used to signal which fork is the supported fork for asset back tokens
*/
contract GlobalPause is Claimable {
    bool public AllTokenPaused = false;
    bool public SupportedFork = true;

    function pauseAllTokens(bool _status) public onlyOwner {
        AllTokenPaused = _status;
    }

    function updateForkStatus(bool _status) public onlyOwner {
        SupportedFork = _status;
    }
}