pragma solidity ^0.4.18;

import "../zeppelin-solidity/contracts/ownership/HasNoEther.sol";
import "../zeppelin-solidity/contracts/ownership/HasNoTokens.sol";
import "../zeppelin-solidity/contracts/ownership/Claimable.sol";
import "../zeppelin-solidity/contracts/math/SafeMath.sol";
import "./TrueUSD.sol";
import "./NamableAddressList.sol";

// The TimeLockedController contract is intended to be the initial Owner of the TrueUSD
// contract and TrueUSD's AddressLists. It splits ownership into two accounts: an "admin" account and an
// "owner" account. The admin of TimeLockedController can initiate minting TrueUSD.
// However, these transactions must be stored
// for ~1 day's worth of blocks first before they can be forwarded to the
// TrueUSD contract. In the event that the admin account is compromised, this
// setup allows the owner of TimeLockedController (which can be stored extremely
// securely since it is never used in normal operation) to replace the admin.
// Once a day has passed, requests can be finalized by the admin.
// Requests initiated by an admin that has since been deposed
// cannot be finalized. The admin is also able to update TrueUSD's AddressLists
// (without a day's delay). The owner can mint without the day's delay, and also
// change other aspects of TrueUSD like the staking fees.
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

    address public admin;
    TrueUSD public trueUSD;
    MintOperation[] public mintOperations;

    modifier onlyAdminOrOwner() {
        require(msg.sender == admin || msg.sender == owner);
        _;
    }

    event MintOperationEvent(address indexed _to, uint256 amount, uint deferBlock, uint opIndex);
    event TransferChildEvent(address indexed _child, address indexed _newOwner);
    event ReclaimEvent(address indexed other);
    event ChangeBurnBoundsEvent(uint newMin, uint newMax);
    event ChangeStakingFeesEvent(uint80 _transferFeeNumerator,
                                            uint80 _transferFeeDenominator,
                                            uint80 _mintFeeNumerator,
                                            uint80 _mintFeeDenominator,
                                            uint256 _mintFeeFlat,
                                            uint80 _burnFeeNumerator,
                                            uint80 _burnFeeDenominator,
                                            uint256 _burnFeeFlat);
    event ChangeStakerEvent(address newStaker);
    event DelegateEvent(DelegateERC20 delegate);
    event SetDelegatedFromEvent(address source);
    event ChangeTrueUSDEvent(TrueUSD newContract);
    event ChangeNameEvent(string name, string symbol);
    event AdminshipTransferred(address indexed previousAdmin, address indexed newAdmin);

    // admin initiates a request to mint _amount TrueUSD for account _to
    function requestMint(address _to, uint256 _amount) public onlyAdminOrOwner {
        uint deferBlock = block.number;
        if (msg.sender != owner) {
            deferBlock = deferBlock.add(blocksDelay);
        }
        MintOperation memory op = MintOperation(_to, _amount, admin, deferBlock);
        MintOperationEvent(_to, _amount, deferBlock, mintOperations.length);
        mintOperations.push(op);
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

    // Transfer ownership of _child to _newOwner
    // Can be used e.g. to upgrade this TimeLockedController contract.
    function transferChild(Ownable _child, address _newOwner) public onlyOwner {
        TransferChildEvent(_child, _newOwner);
        _child.transferOwnership(_newOwner);
    }

    // Transfer ownership of a contract from trueUSD
    // to this TimeLockedController. Can be used e.g. to reclaim balance sheet
    // in order to transfer it to an upgraded TrueUSD contract.
    function requestReclaim(Ownable other) public onlyOwner {
        ReclaimEvent(other);
        trueUSD.reclaimContract(other);
    }

    // Change the minimum and maximum amounts that TrueUSD users can
    // burn to newMin and newMax
    function changeBurnBounds(uint newMin, uint newMax) public onlyOwner {
        ChangeBurnBoundsEvent(newMin, newMax);
        trueUSD.changeBurnBounds(newMin, newMax);
    }

    // Change the transaction fees charged on transfer/mint/burn
    function changeStakingFees(uint80 _transferFeeNumerator,
                               uint80 _transferFeeDenominator,
                               uint80 _mintFeeNumerator,
                               uint80 _mintFeeDenominator,
                               uint256 _mintFeeFlat,
                               uint80 _burnFeeNumerator,
                               uint80 _burnFeeDenominator,
                               uint256 _burnFeeFlat) public onlyOwner {
        ChangeStakingFeesEvent(_transferFeeNumerator,
                                          _transferFeeDenominator,
                                          _mintFeeNumerator,
                                          _mintFeeDenominator,
                                          _mintFeeFlat,
                                          _burnFeeNumerator,
                                          _burnFeeDenominator,
                                          _burnFeeFlat);
        trueUSD.changeStakingFees(_transferFeeNumerator,
                                  _transferFeeDenominator,
                                  _mintFeeNumerator,
                                  _mintFeeDenominator,
                                  _mintFeeFlat,
                                  _burnFeeNumerator,
                                  _burnFeeDenominator,
                                  _burnFeeFlat);
    }

    // Change the recipient of staking fees to newStaker
    function changeStaker(address newStaker) public onlyOwner {
        ChangeStakerEvent(newStaker);
        trueUSD.changeStaker(newStaker);
    }

    // Future ERC20 calls to trueUSD be delegated to _delegate
    function delegateToNewContract(DelegateERC20 delegate) public onlyOwner {
        DelegateEvent(delegate);
        trueUSD.delegateToNewContract(delegate);
    }

    // Incoming delegate* calls from _source will be accepted by trueUSD
    function setDelegatedFrom(address _source) public onlyOwner {
        SetDelegatedFromEvent(_source);
        trueUSD.setDelegatedFrom(_source);
    }

    // Update this contract's trueUSD pointer to newContract (e.g. if the
    // contract is upgraded)
    function setTrueUSD(TrueUSD newContract) public onlyOwner {
        ChangeTrueUSDEvent(newContract);
        trueUSD = newContract;
    }

    // change trueUSD's name and symbol
    function changeName(string name, string symbol) public onlyOwner {
        ChangeNameEvent(name, symbol);
        trueUSD.changeName(name, symbol);
    }

    // Replace the current admin with newAdmin
    function transferAdminship(address newAdmin) public onlyOwner {
        AdminshipTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // Swap out TrueUSD's address lists
    function setLists(AddressList _canReceiveMintWhiteList, AddressList _canBurnWhiteList, AddressList _blackList, AddressList _noFeesList) onlyOwner public {
        trueUSD.setLists(_canReceiveMintWhiteList, _canBurnWhiteList, _blackList, _noFeesList);
    }

    // Update a whitelist/blacklist
    function updateList(address list, address entry, bool flag) public onlyAdminOrOwner {
        AddressList(list).changeList(entry, flag);
    }

    // Rename a whitelist/blacklist
    function renameList(address list, string name) public onlyAdminOrOwner {
        NamableAddressList(list).changeName(name);
    }

    // Claim ownership of an arbitrary Claimable contract
    function issueClaimOwnership(address _other) public onlyAdminOrOwner {
        Claimable other = Claimable(_other);
        other.claimOwnership();
    }
}
