pragma solidity ^0.4.17;

import 'zeppelin-solidity/contracts/ownership/HasNoEther.sol';
import 'zeppelin-solidity/contracts/ownership/HasNoTokens.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './TrueUSD.sol';

// somewhat based on https://github.com/bitclave/Multiownable/blob/master/contracts/Multiownable.sol
// A LimitedAdmin is supposed to be the Owner of a TrueUSD contract ('child'). The 
// 'admin' can call mint and transferOwnership on the child, and they can be forwarded to the child
// after some number of blocks have elapsed. The owner of the LimitedAdmin can 
// replace the admin, cancelling all pending calls (unless the admin is quickly restored)
contract LimitedAdmin is Ownable, HasNoEther, HasNoTokens {

    uint public constant blocksDelay = 24*60*60/15; // 24 hours, assuming a 15 second blocktime

    struct MintOperation {
        address _to;
        uint256 _amount;
        address admin;
        uint releaseBlock;
    };
    
    struct TransferOwnershipOperation {
        address newOwner;
        address admin;
        uint releaseBlock;
    };

    address public admin;
    TrueUSD public child;
    MintOperation[] public mintOperations;
    TransferOwnershipOperation public transferOwnershipOperation;
    
    event MintOperationEvent(MintOperation op, uint opIndex);
    event TransferOwnershipOperationEvent(TransferOwnershipOperation op);
    event AdminshipTransferred(address indexed previousAdmin, address indexed newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }
    
    function requestMint(address _to, uint256 _amount) public onlyAdmin {
        op = MintOperation(_to, _amount, admin, block.number + blocksDelay);
        uint opIndex = mintOperations.length;
        event MintOperationEvent(op, opIndex);
        mintOperationsIndicies[op] = opIndex;
        mintOperations.push(op);
    }
    
    function requestTransferOwnership(address newOwner) public onlyAdmin {
        op = TransferOwnershipOperation(newOwner, admin, block.number + blocksDelay);
        event TransferOwnershipOperationEvent(op);
        transferOwnershipOperation = op;
    }
    
    function releaseMint(uint index) public {
        MintOperation op = mintOperations[index];
        require(op.admin == admin); //checks that the requester's adminship has not been revoked
        require(op.releaseBlock <= block.number); //checks that enough time has elapsed
        address to = op._to;
        uint256 amount = op._amount;
        delete mintOperations[index];
        child.mint(to, amount);
    }
    
    function releaseTransferOwnership() public {
        require(transferOwnershipOperation.admin == admin);
        require(transferOwnershipOperation.releaseBlock <= block.number);
        address newOwner = transferOwnershipOperation._newOwner;
        delete transferOwnershipOperation;
        child.transferOwnership(newOwner);
    }
    
    function transferAdminship(address newAdmin) public onlyOwner {
        require(newAdmin != address(0));
        AdminshipTransferred(admin, newAdmin);
        admin = newAdmin;
    }
}