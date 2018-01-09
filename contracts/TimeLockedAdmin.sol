pragma solidity ^0.4.17;

import 'zeppelin-solidity/contracts/ownership/HasNoEther.sol';
import 'zeppelin-solidity/contracts/ownership/HasNoTokens.sol';
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import './TrueUSD.sol';

// The TimeLockedAdmin contract is intended to be the initial Owner of the TrueUSD
// contract. It splits ownership into two accounts: an "admin" account and an
// "owner" account. The admin of TimeLockedAdmin can initiate two kinds of
// transactions: minting TUSD, and transferring ownership of the TrueUSD
// contract to a new owner. However, both of these transactions must be stored
// for ~1 day's worth of blocks first before they can be forwarded to the
// TrueUSD contract. In the event that the admin account is compromised, this
// setup allows the owner of TimeLockedAdmin (which can be stored extremely
// securely since it is never used in normal operation) to replace the admin.
// Once a day has passed, all mint and ownership transfer requests can be
// finalized by the beneficiary (the token recipient or the new owner,
// respectively). Requests initiated by an admin that has since been deposed
// cannot be finalized.
contract TimeLockedAdmin is Ownable, HasNoEther, HasNoTokens {

    uint public constant blocksDelay = 24*60*60/15; // 24 hours, assuming a 15 second blocktime

    struct MintOperation {
        address to;
        uint256 amount;
        address admin;
        uint deferBlock;
    }

    struct TransferOwnershipOperation {
        address newOwner;
        address admin;
        uint deferBlock;
    }

    struct ChangeBurnBoundsOperation {
        uint newMin;
        uint newMax;
        address admin;
        uint deferBlock;
    }

    address public admin;
    TrueUSD public child;
    MintOperation[] public mintOperations;
    TransferOwnershipOperation public transferOwnershipOperation;
    ChangeBurnBoundsOperation public changeBurnBoundsOperation;

    // starts with no admin
    function TimeLockedAdmin(address _child) public {
        child = TrueUSD(_child);
    }

    event MintOperationEvent(MintOperation op, uint opIndex);
    event TransferOwnershipOperationEvent(TransferOwnershipOperation op);
    event ChangeBurnBoundsOperationEvent(ChangeBurnBoundsOperation op);
    event AdminshipTransferred(address indexed previousAdmin, address indexed newAdmin);

    // admin initiates a request to mint _amount TUSD for account _to
    function requestMint(address _to, uint256 _amount) public {
        require(msg.sender == admin);
        MintOperation memory op = MintOperation(_to, _amount, admin, block.number + blocksDelay);
        MintOperationEvent(op, mintOperations.length);
        mintOperations.push(op);
    }

    // admin initiates a request to transfer ownership of the TrueUSD contract to newOwner.
    // Can be used e.g. to upgrade this TimeLockedAdmin contract.
    function requestTransferOwnership(address newOwner) public {
        require(msg.sender == admin);
        TransferOwnershipOperation memory op = TransferOwnershipOperation(newOwner, admin, block.number + blocksDelay);
        TransferOwnershipOperationEvent(op);
        transferOwnershipOperation = op;
    }

    // admin initiates a request that the minimum and maximum amounts that any trueUSD user can
    // burn become newMin and newMax
    function requestChangeBurnBounds(uint newMin, uint newMax) public {
        require(msg.sender == admin);
        ChangeBurnBoundsOperation memory op = ChangeBurnBoundsOperation(newMin, newMax, admin, block.number + blocksDelay);
        ChangeBurnBoundsOperationEvent(op);
        changeBurnBoundsOperation = op;
    }

    // after a day, beneficiary of a mint request finalizes it by providing the
    // index of the request (visible in the MintOperationEvent accompanying the original request)
    function finalizeMint(uint index) public {
        MintOperation memory op = mintOperations[index];
        require(op.admin == admin); //checks that the requester's adminship has not been revoked
        require(op.deferBlock <= block.number); //checks that enough time has elapsed
        require(op.to == msg.sender); //only the recipient of the funds can finalize
        address to = op.to;
        uint256 amount = op.amount;
        delete mintOperations[index];
        child.mint(to, amount);
    }

    // after a day, prospective new owner of TrueUSD finalizes the ownership change
    function finalizeTransferOwnership() public {
        require(transferOwnershipOperation.admin == admin);
        require(transferOwnershipOperation.deferBlock <= block.number);
        require(transferOwnershipOperation.newOwner == msg.sender);
        address newOwner = transferOwnershipOperation.newOwner;
        delete transferOwnershipOperation;
        child.transferOwnership(newOwner);
    }

    // after a day, admin finalizes the burn bounds change
    function finalizeChangeBurnBounds() public {
        require(msg.sender == admin);
        require(changeBurnBoundsOperation.admin == admin);
        require(changeBurnBoundsOperation.deferBlock <= block.number);
        uint newMin = changeBurnBoundsOperation.newMin;
        uint newMax = changeBurnBoundsOperation.newMax;
        delete changeBurnBoundsOperation;
        child.changeBurnBounds(newMin, newMax);
    }

    // Owner of this contract (immediately) replaces the current admin with newAdmin
    function transferAdminship(address newAdmin) public onlyOwner {
        AdminshipTransferred(admin, newAdmin);
        admin = newAdmin;
    }
}