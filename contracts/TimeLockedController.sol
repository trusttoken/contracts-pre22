pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/HasNoEther.sol";
import "zeppelin-solidity/contracts/ownership/HasNoTokens.sol";
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./TrueUSD.sol";

// The TimeLockedController contract is intended to be the initial Owner of the TrueUSD
// contract and TrueUSD's AddressLists. It splits ownership into two accounts: an "admin" account and an
// "owner" account. The admin of TimeLockedController can initiate two kinds of
// transactions: minting TrueUSD, and transferring ownership of the TrueUSD
// contract to a new owner. However, both of these transactions must be stored
// for ~1 day's worth of blocks first before they can be forwarded to the
// TrueUSD contract. In the event that the admin account is compromised, this
// setup allows the owner of TimeLockedController (which can be stored extremely
// securely since it is never used in normal operation) to replace the admin.
// Once a day has passed, all mint and ownership transfer requests can be
// finalized by the beneficiary (the token recipient or the new owner,
// respectively); mint requests can also be finalized by the admin. Requests initiated by an admin that has since been deposed
// cannot be finalized. The admin is also able to update TrueUSD's AddressLists
// (without a day's delay). Anything the admin can do, the owner can also do
// without a delay.
contract TimeLockedController is Ownable, HasNoEther, HasNoTokens {
    using SafeMath for uint256;

    // 24 hours, assuming a 15 second blocktime.
    // As long as this isn't too far off from reality it doesn't really matter.
    uint public constant blocksDelay = 24*60*60/15;

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

    struct ChangeInsuranceFeesOperation {
        uint80 _transferFeeNumerator;
        uint80 _transferFeeDenominator;
        uint80 _mintFeeNumerator;
        uint80 _mintFeeDenominator;
        uint256 _mintFeeFlat;
        uint80 _burnFeeNumerator;
        uint80 _burnFeeDenominator;
        uint256 _burnFeeFlat;
        address admin;
        uint deferBlock;
    }

    struct ChangeInsurerOperation {
        address newInsurer;
        address admin;
        uint deferBlock;
    }

    address public admin;
    TrueUSD public child;
    AddressList public canBurnWhiteList;
    AddressList public canReceiveMintWhitelist;
    AddressList public blackList;
    MintOperation[] public mintOperations;
    TransferOwnershipOperation public transferOwnershipOperation;
    ChangeBurnBoundsOperation public changeBurnBoundsOperation;
    ChangeInsuranceFeesOperation public changeInsuranceFeesOperation;
    ChangeInsurerOperation public changeInsurerOperation;

    modifier onlyAdminOrOwner() {
        require(msg.sender == admin || msg.sender == owner);
        _;
    }

    function computeDeferBlock() private view returns (uint) {
        if (msg.sender == owner) {
            return block.number;
        } else {
            return block.number.add(blocksDelay);
        }
    }

    // starts with no admin
    function TimeLockedController(address _child, address _canBurnWhiteList, address _canReceiveMintWhitelist, address _blackList) public {
        child = TrueUSD(_child);
        canBurnWhiteList = AddressList(_canBurnWhiteList);
        canReceiveMintWhitelist = AddressList(_canReceiveMintWhitelist);
        blackList = AddressList(_blackList);
    }

    event MintOperationEvent(address indexed _to, uint256 amount, uint deferBlock, uint opIndex);
    event TransferOwnershipOperationEvent(address newOwner, uint deferBlock);
    event ChangeBurnBoundsOperationEvent(uint newMin, uint newMax, uint deferBlock);
    event ChangeInsuranceFeesOperationEvent(uint80 _transferFeeNumerator,
                                            uint80 _transferFeeDenominator,
                                            uint80 _mintFeeNumerator,
                                            uint80 _mintFeeDenominator,
                                            uint256 _mintFeeFlat,
                                            uint80 _burnFeeNumerator,
                                            uint80 _burnFeeDenominator,
                                            uint256 _burnFeeFlat,
                                            uint deferBlock);
    event ChangeInsurerOperationEvent(address newInsurer, uint deferBlock);
    event AdminshipTransferred(address indexed previousAdmin, address indexed newAdmin);

    // admin initiates a request to mint _amount TrueUSD for account _to
    function requestMint(address _to, uint256 _amount) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        MintOperation memory op = MintOperation(_to, _amount, admin, deferBlock);
        MintOperationEvent(_to, _amount, deferBlock, mintOperations.length);
        mintOperations.push(op);
    }

    // admin initiates a request to transfer ownership of the TrueUSD contract and all AddressLists to newOwner.
    // Can be used e.g. to upgrade this TimeLockedController contract.
    function requestTransferChildrenOwnership(address newOwner) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        transferOwnershipOperation = TransferOwnershipOperation(newOwner, admin, deferBlock);
        TransferOwnershipOperationEvent(newOwner, deferBlock);
    }

    // admin initiates a request that the minimum and maximum amounts that any TrueUSD user can
    // burn become newMin and newMax
    function requestChangeBurnBounds(uint newMin, uint newMax) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        changeBurnBoundsOperation = ChangeBurnBoundsOperation(newMin, newMax, admin, deferBlock);
        ChangeBurnBoundsOperationEvent(newMin, newMax, deferBlock);
    }

    // admin initiates a request that the insurance fee be changed
    function requestChangeInsuranceFees(uint80 _transferFeeNumerator,
                                        uint80 _transferFeeDenominator,
                                        uint80 _mintFeeNumerator,
                                        uint80 _mintFeeDenominator,
                                        uint256 _mintFeeFlat,
                                        uint80 _burnFeeNumerator,
                                        uint80 _burnFeeDenominator,
                                        uint256 _burnFeeFlat) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        changeInsuranceFeesOperation = ChangeInsuranceFeesOperation(_transferFeeNumerator,
                                                                    _transferFeeDenominator,
                                                                    _mintFeeNumerator,
                                                                    _mintFeeDenominator,
                                                                    _mintFeeFlat,
                                                                    _burnFeeNumerator,
                                                                    _burnFeeDenominator,
                                                                    _burnFeeFlat,
                                                                    admin,
                                                                    deferBlock);
        ChangeInsuranceFeesOperationEvent(_transferFeeNumerator,
                                          _transferFeeDenominator,
                                          _mintFeeNumerator,
                                          _mintFeeDenominator,
                                          _mintFeeFlat,
                                          _burnFeeNumerator,
                                          _burnFeeDenominator,
                                          _burnFeeFlat,
                                          deferBlock);
    }

    // admin initiates a request that the recipient of the insurance fee be changed to newInsurer
    function requestChangeInsurer(address newInsurer) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        changeInsurerOperation = ChangeInsurerOperation(newInsurer, admin, deferBlock);
        ChangeInsurerOperationEvent(newInsurer, deferBlock);
    }

    // after a day, beneficiary of a mint request finalizes it by providing the
    // index of the request (visible in the MintOperationEvent accompanying the original request)
    function finalizeMint(uint index) public {
        MintOperation memory op = mintOperations[index];
        require(op.admin == admin); //checks that the requester's adminship has not been revoked
        require(op.deferBlock <= block.number); //checks that enough time has elapsed
        require(op.to == msg.sender || admin == msg.sender); //only the recipient of the funds or the admin can finalize
        address to = op.to;
        uint256 amount = op.amount;
        delete mintOperations[index];
        child.mint(to, amount);
    }

    // after a day, prospective new owner of TrueUSD finalizes the ownership change
    function finalizeTransferChildrenOwnership() public {
        require(transferOwnershipOperation.admin == admin);
        require(transferOwnershipOperation.deferBlock <= block.number);
        require(transferOwnershipOperation.newOwner == msg.sender);
        address newOwner = transferOwnershipOperation.newOwner;
        delete transferOwnershipOperation;
        child.transferOwnership(newOwner);
        canBurnWhiteList.transferOwnership(newOwner);
        canReceiveMintWhitelist.transferOwnership(newOwner);
        blackList.transferOwnership(newOwner);
    }

    // after a day, admin finalizes the burn bounds change
    function finalizeChangeBurnBounds() public onlyAdminOrOwner {
        require(changeBurnBoundsOperation.admin == admin);
        require(changeBurnBoundsOperation.deferBlock <= block.number);
        uint newMin = changeBurnBoundsOperation.newMin;
        uint newMax = changeBurnBoundsOperation.newMax;
        delete changeBurnBoundsOperation;
        child.changeBurnBounds(newMin, newMax);
    }

    // after a day, admin finalizes the insurance fee change
    function finalizeChangeInsuranceFees() public onlyAdminOrOwner {
        require(changeInsuranceFeesOperation.admin == admin);
        require(changeInsuranceFeesOperation.deferBlock <= block.number);
        uint80 _transferFeeNumerator = changeInsuranceFeesOperation._transferFeeNumerator;
        uint80 _transferFeeDenominator = changeInsuranceFeesOperation._transferFeeDenominator;
        uint80 _mintFeeNumerator = changeInsuranceFeesOperation._mintFeeNumerator;
        uint80 _mintFeeDenominator = changeInsuranceFeesOperation._mintFeeDenominator;
        uint256 _mintFeeFlat = changeInsuranceFeesOperation._mintFeeFlat;
        uint80 _burnFeeNumerator = changeInsuranceFeesOperation._burnFeeNumerator;
        uint80 _burnFeeDenominator = changeInsuranceFeesOperation._burnFeeDenominator;
        uint256 _burnFeeFlat = changeInsuranceFeesOperation._burnFeeFlat;
        delete changeInsuranceFeesOperation;
        child.changeInsuranceFees(_transferFeeNumerator,
                                  _transferFeeDenominator,
                                  _mintFeeNumerator,
                                  _mintFeeDenominator,
                                  _mintFeeFlat,
                                  _burnFeeNumerator,
                                  _burnFeeDenominator,
                                  _burnFeeFlat);
    }

    // after a day, admin finalizes the insurance fees recipient change
    function finalizeChangeInsurer() public onlyAdminOrOwner {
        require(changeInsurerOperation.admin == admin);
        require(changeInsurerOperation.deferBlock <= block.number);
        address newInsurer = changeInsurerOperation.newInsurer;
        delete changeInsurerOperation;
        child.changeInsurer(newInsurer);
    }

    // Owner of this contract (immediately) replaces the current admin with newAdmin
    function transferAdminship(address newAdmin) public onlyOwner {
        AdminshipTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // admin (immediately) updates a whitelist/blacklist
    function updateList(address list, address entry, bool flag) public onlyAdminOrOwner {
        AddressList(list).changeList(entry, flag);
    }
}
