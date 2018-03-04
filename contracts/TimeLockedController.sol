pragma solidity ^0.4.18;

import "../zeppelin-solidity/contracts/ownership/HasNoEther.sol";
import "../zeppelin-solidity/contracts/ownership/HasNoTokens.sol";
import "../zeppelin-solidity/contracts/ownership/Claimable.sol";
import "../zeppelin-solidity/contracts/math/SafeMath.sol";
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
// Once a day has passed, requests can be finalized by the admin.
// Requests initiated by an admin that has since been deposed
// cannot be finalized. The admin is also able to update TrueUSD's AddressLists
// (without a day's delay). Anything the admin can do, the owner can also do
// without a delay.
contract TimeLockedController is HasNoEther, HasNoTokens, Claimable {
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

    struct TransferChildOperation {
        Ownable child;
        address newOwner;
        address admin;
        uint deferBlock;
    }

    struct ReclaimOperation {
        Ownable other;
        address admin;
        uint deferBlock;
    }

    struct ChangeBurnBoundsOperation {
        uint newMin;
        uint newMax;
        address admin;
        uint deferBlock;
    }

    struct ChangeStakingFeesOperation {
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

    struct ChangeStakerOperation {
        address newStaker;
        address admin;
        uint deferBlock;
    }

    struct DelegateOperation {
        DelegateERC20 delegate;
        address admin;
        uint deferBlock;
    }

    struct SetDelegatedFromOperation {
        address source;
        address admin;
        uint deferBlock;
    }

    struct ChangeTrueUSDOperation {
        TrueUSD newContract;
        address admin;
        uint deferBlock;
    }

    struct ChangeNameOperation {
        string name;
        string symbol;
        address admin;
        uint deferBlock;
    }

    address public admin;
    TrueUSD public trueUSD;
    MintOperation[] public mintOperations;
    TransferChildOperation[] public transferChildOperations;
    ReclaimOperation[] public reclaimOperations;
    ChangeBurnBoundsOperation public changeBurnBoundsOperation;
    ChangeStakingFeesOperation public changeStakingFeesOperation;
    ChangeStakerOperation public changeStakerOperation;
    DelegateOperation public delegateOperation;
    SetDelegatedFromOperation public setDelegatedFromOperation;
    ChangeTrueUSDOperation public changeTrueUSDOperation;
    ChangeNameOperation public changeNameOperation;

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
    function TimeLockedController(address _trueUSD) public {
        trueUSD = TrueUSD(_trueUSD);
    }

    event MintOperationEvent(address indexed _to, uint256 amount, uint deferBlock, uint opIndex);
    event TransferChildOperationEvent(address indexed _child, address indexed _newOwner, uint deferBlock, uint opIndex);
    event ReclaimOperationEvent(address indexed other, uint deferBlock, uint opIndex);
    event ChangeBurnBoundsOperationEvent(uint newMin, uint newMax, uint deferBlock);
    event ChangeStakingFeesOperationEvent(uint80 _transferFeeNumerator,
                                            uint80 _transferFeeDenominator,
                                            uint80 _mintFeeNumerator,
                                            uint80 _mintFeeDenominator,
                                            uint256 _mintFeeFlat,
                                            uint80 _burnFeeNumerator,
                                            uint80 _burnFeeDenominator,
                                            uint256 _burnFeeFlat,
                                            uint deferBlock);
    event ChangeStakerOperationEvent(address newStaker, uint deferBlock);
    event DelegateOperationEvent(DelegateERC20 delegate, uint deferBlock);
    event SetDelegatedFromOperationEvent(address source, uint deferBlock);
    event ChangeTrueUSDOperationEvent(TrueUSD newContract, uint deferBlock);
    event ChangeNameOperationEvent(string name, string symbol, uint deferBlock);
    event AdminshipTransferred(address indexed previousAdmin, address indexed newAdmin);

    // admin initiates a request to mint _amount TrueUSD for account _to
    function requestMint(address _to, uint256 _amount) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        MintOperation memory op = MintOperation(_to, _amount, admin, deferBlock);
        MintOperationEvent(_to, _amount, deferBlock, mintOperations.length);
        mintOperations.push(op);
    }

    // admin initiates a request to transfer _child to _newOwner
    // Can be used e.g. to upgrade this TimeLockedController contract.
    function requestTransferChild(Ownable _child, address _newOwner) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        TransferChildOperation memory op = TransferChildOperation(_child, _newOwner, admin, deferBlock);
        TransferChildOperationEvent(_child, _newOwner, deferBlock, transferChildOperations.length);
        transferChildOperations.push(op);
    }

    // admin initiates a request to transfer ownership of a contract from trueUSD
    // to this TimeLockedController. Can be used e.g. to reclaim balance sheet
    // in order to transfer it to an upgraded TrueUSD contract.
    function requestReclaim(Ownable other) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        ReclaimOperation memory op = ReclaimOperation(other, admin, deferBlock);
        ReclaimOperationEvent(other, deferBlock, reclaimOperations.length);
        reclaimOperations.push(op);
    }

    // admin initiates a request that the minimum and maximum amounts that any TrueUSD user can
    // burn become newMin and newMax
    function requestChangeBurnBounds(uint newMin, uint newMax) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        changeBurnBoundsOperation = ChangeBurnBoundsOperation(newMin, newMax, admin, deferBlock);
        ChangeBurnBoundsOperationEvent(newMin, newMax, deferBlock);
    }

    // admin initiates a request that the staking fee be changed
    function requestChangeStakingFees(uint80 _transferFeeNumerator,
                                        uint80 _transferFeeDenominator,
                                        uint80 _mintFeeNumerator,
                                        uint80 _mintFeeDenominator,
                                        uint256 _mintFeeFlat,
                                        uint80 _burnFeeNumerator,
                                        uint80 _burnFeeDenominator,
                                        uint256 _burnFeeFlat) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        changeStakingFeesOperation = ChangeStakingFeesOperation(_transferFeeNumerator,
                                                                    _transferFeeDenominator,
                                                                    _mintFeeNumerator,
                                                                    _mintFeeDenominator,
                                                                    _mintFeeFlat,
                                                                    _burnFeeNumerator,
                                                                    _burnFeeDenominator,
                                                                    _burnFeeFlat,
                                                                    admin,
                                                                    deferBlock);
        ChangeStakingFeesOperationEvent(_transferFeeNumerator,
                                          _transferFeeDenominator,
                                          _mintFeeNumerator,
                                          _mintFeeDenominator,
                                          _mintFeeFlat,
                                          _burnFeeNumerator,
                                          _burnFeeDenominator,
                                          _burnFeeFlat,
                                          deferBlock);
    }

    // admin initiates a request that the recipient of the staking fee be changed to newStaker
    function requestChangeStaker(address newStaker) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        changeStakerOperation = ChangeStakerOperation(newStaker, admin, deferBlock);
        ChangeStakerOperationEvent(newStaker, deferBlock);
    }

    // admin initiates a request that future ERC20 calls to trueUSD be delegated to _delegate
    function requestDelegation(DelegateERC20 _delegate) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        delegateOperation = DelegateOperation(_delegate, admin, deferBlock);
        DelegateOperationEvent(_delegate, deferBlock);
    }

    // admin initiates a request that incoming delegate* calls from _source be
    // accepted by trueUSD
    function requestDelegatedFrom(address _source) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        setDelegatedFromOperation = SetDelegatedFromOperation(_source, admin, deferBlock);
        SetDelegatedFromOperationEvent(_source, deferBlock);
    }

    // admin initiates a request that this contract's trueUSD pointer be updated to newContract
    function requestReplaceTrueUSD(TrueUSD newContract) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        changeTrueUSDOperation = ChangeTrueUSDOperation(newContract, admin, deferBlock);
        ChangeTrueUSDOperationEvent(newContract, deferBlock);
    }

    // admin initiates a request that trueUSD's name and symbol be changed
    function requestNameChange(string name, string symbol) public onlyAdminOrOwner {
        uint deferBlock = computeDeferBlock();
        changeNameOperation = ChangeNameOperation(name, symbol, admin, deferBlock);
        ChangeNameOperationEvent(name, symbol, deferBlock);
    }

    // after a day, admin finalizes mint request by providing the
    // index of the request (visible in the MintOperationEvent accompanying the original request)
    function finalizeMint(uint index) public onlyAdminOrOwner {
        MintOperation memory op = mintOperations[index];
        require(op.admin == admin); //checks that the requester's adminship has not been revoked
        require(op.deferBlock <= block.number); //checks that enough time has elapsed
        address to = op.to;
        uint256 amount = op.amount;
        delete mintOperations[index];
        trueUSD.mint(to, amount);
    }

    // after a day, admin finalizes the transfer of a child contract by providing the
    // index of the request (visible in the TransferChildOperationEvent accompanying the original request)
    function finalizeTransferChild(uint index) public onlyAdminOrOwner {
        TransferChildOperation memory op = transferChildOperations[index];
        require(op.admin == admin);
        require(op.deferBlock <= block.number);
        Ownable _child = op.child;
        address _newOwner = op.newOwner;
        delete transferChildOperations[index];
        _child.transferOwnership(_newOwner);
    }

    function finalizeReclaim(uint index) public onlyAdminOrOwner {
        ReclaimOperation memory op = reclaimOperations[index];
        require(op.admin == admin);
        require(op.deferBlock <= block.number);
        Ownable other = op.other;
        delete reclaimOperations[index];
        trueUSD.reclaimContract(other);
    }

    // after a day, admin finalizes the burn bounds change
    function finalizeChangeBurnBounds() public onlyAdminOrOwner {
        require(changeBurnBoundsOperation.admin == admin);
        require(changeBurnBoundsOperation.deferBlock <= block.number);
        uint newMin = changeBurnBoundsOperation.newMin;
        uint newMax = changeBurnBoundsOperation.newMax;
        delete changeBurnBoundsOperation;
        trueUSD.changeBurnBounds(newMin, newMax);
    }

    // after a day, admin finalizes the staking fee change
    function finalizeChangeStakingFees() public onlyAdminOrOwner {
        require(changeStakingFeesOperation.admin == admin);
        require(changeStakingFeesOperation.deferBlock <= block.number);
        uint80 _transferFeeNumerator = changeStakingFeesOperation._transferFeeNumerator;
        uint80 _transferFeeDenominator = changeStakingFeesOperation._transferFeeDenominator;
        uint80 _mintFeeNumerator = changeStakingFeesOperation._mintFeeNumerator;
        uint80 _mintFeeDenominator = changeStakingFeesOperation._mintFeeDenominator;
        uint256 _mintFeeFlat = changeStakingFeesOperation._mintFeeFlat;
        uint80 _burnFeeNumerator = changeStakingFeesOperation._burnFeeNumerator;
        uint80 _burnFeeDenominator = changeStakingFeesOperation._burnFeeDenominator;
        uint256 _burnFeeFlat = changeStakingFeesOperation._burnFeeFlat;
        delete changeStakingFeesOperation;
        trueUSD.changeStakingFees(_transferFeeNumerator,
                                  _transferFeeDenominator,
                                  _mintFeeNumerator,
                                  _mintFeeDenominator,
                                  _mintFeeFlat,
                                  _burnFeeNumerator,
                                  _burnFeeDenominator,
                                  _burnFeeFlat);
    }

    // after a day, admin finalizes the staking fees recipient change
    function finalizeChangeStaker() public onlyAdminOrOwner {
        require(changeStakerOperation.admin == admin);
        require(changeStakerOperation.deferBlock <= block.number);
        address newStaker = changeStakerOperation.newStaker;
        delete changeStakerOperation;
        trueUSD.changeStaker(newStaker);
    }

    // after a day, admin finalizes the delegation
    function finalizeDelegation() public onlyAdminOrOwner {
        require(delegateOperation.admin == admin);
        require(delegateOperation.deferBlock <= block.number);
        DelegateERC20 delegate = delegateOperation.delegate;
        delete delegateOperation;
        trueUSD.delegateToNewContract(delegate);
    }

    function finalizeSetDelegatedFrom() public onlyAdminOrOwner {
        require(setDelegatedFromOperation.admin == admin);
        require(setDelegatedFromOperation.deferBlock <= block.number);
        address source = setDelegatedFromOperation.source;
        delete setDelegatedFromOperation;
        trueUSD.setDelegatedFrom(source);
    }

    function finalizeReplaceTrueUSD() public onlyAdminOrOwner {
        require(changeTrueUSDOperation.admin == admin);
        require(changeTrueUSDOperation.deferBlock <= block.number);
        TrueUSD newContract = changeTrueUSDOperation.newContract;
        delete changeTrueUSDOperation;
        trueUSD = newContract;
    }

    function finalizeChangeName() public onlyAdminOrOwner {
        require(changeNameOperation.admin == admin);
        require(changeNameOperation.deferBlock <= block.number);
        string memory name = changeNameOperation.name;
        string memory symbol = changeNameOperation.symbol;
        delete changeNameOperation;
        trueUSD.changeName(name, symbol);
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

    function issueClaimOwnership(address _other) public onlyAdminOrOwner {
        Claimable other = Claimable(_other);
        other.claimOwnership();
    }
}
