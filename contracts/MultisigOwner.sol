pragma solidity ^0.4.23;
import "./Claimable.sol";
import "./timeLock.sol";

contract MultiSigOwner {
    mapping (address => bool) public Owners;
    uint8 constant public QUORUM = 2;
    
    TimeLockedController public timeLockController;
    
    modifier onlyOwner(){
        require(Owners[msg.sender]);
        _;
    }

    struct action{
        string action;
    }
    
    constructor(address[3] _initialOwners){
        Owners[_initialOwners[0]]=true;
        Owners[_initialOwners[1]]=true;
        Owners[_initialOwners[2]]=true;
    }
    
    function issueClaimOwnership(address _other) public onlyOwner returns(bool success) {
        Claimable other = Claimable(_other);
        other.claimOwnership();
        return true;
    }
    
    function setTimeLockController (address _newController) public onlyOwner {
        require(issueClaimOwnership(_newController));
        timeLockController = TimeLockedController(_newController);
    }
    
    function
    
    
} 