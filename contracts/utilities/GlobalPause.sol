pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/Claimable.sol";

/*
All future trusttoken tokens can reference this contract. 
Allow for Admin to pause a set of tokens with one transaction
Used to signal which fork is the supported fork for asset-back tokens
*/
contract GlobalPause is Claimable {
    bool public allTokensPaused = false;
    string public pauseNotice;

    function pauseAllTokens(bool _status, string _notice) public onlyOwner {
        allTokensPaused = _status;
        pauseNotice = _notice;
    }

    function requireNotPaused() public view {
        require(!allTokensPaused, pauseNotice);
    }
}
