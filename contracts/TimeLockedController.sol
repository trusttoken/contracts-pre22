pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/HasNoEther.sol";
import "zeppelin-solidity/contracts/ownership/HasNoTokens.sol";
import "zeppelin-solidity/contracts/ownership/Claimable.sol";
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "./TrueUSD.sol";
import "./NamableAddressList.sol";

// The TimeLockedController contract is intended to be the initial Owner of the TrueUSD
// contract and TrueUSD's AddressLists. It splits ownership into two accounts: an "admin" account and an
// "owner" account. The admin of TimeLockedController can initiate minting TrueUSD.
// However, these transactions must be stored
// for 1 day first before they can be forwarded to the
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

    uint256 public mintDelay = 1 days;

    struct MintOperation {
        address to;
        uint256 amount;
        address admin;
        uint256 releaseTimestamp;
    }

    address public admin;
    TrueUSD public trueUSD;
    MintOperation[] public mintOperations;

    modifier onlyAdminOrOwner() {
        require(msg.sender == admin || msg.sender == owner);
        _;
    }

    event TLCRequestMint(address indexed to, address indexed admin, uint256 amount, uint256 releaseTimestamp, uint256 opIndex);
    event TLCTransferChild(address indexed child, address indexed newOwner);
    event TLCRequestReclaim(address indexed other);
    event TLCChangeBurnBounds(uint256 newMin, uint256 newMax);
    event TLCChangeStakingFees(uint256 transferFeeNumerator,
                               uint256 transferFeeDenominator,
                               uint256 mintFeeNumerator,
                               uint256 mintFeeDenominator,
                               uint256 mintFeeFlat,
                               uint256 burnFeeNumerator,
                               uint256 burnFeeDenominator,
                               uint256 burnFeeFlat);
    event TLCChangeStaker(address newStaker);
    event TLCDelegateToNewContract(DelegateBurnable delegate);
    event TLCSetDelegatedFrom(address source);
    event TLCSetTrueUSD(TrueUSD newContract);
    event TLCChangeTokenName(string name, string symbol);
    event TLCTransferAdminship(address indexed previousAdmin, address indexed newAdmin);
    event TLCChangeMintDelay(uint256 newDelay);

    function TimeLockedController() public {
        admin = msg.sender;
    }

    // admin initiates a request to mint _amount TrueUSD for account _to
    function requestMint(address _to, uint256 _amount) public onlyAdminOrOwner {
        uint256 releaseTimestamp = block.timestamp;
        if (msg.sender != owner) {
            releaseTimestamp = releaseTimestamp.add(mintDelay);
        }
        MintOperation memory op = MintOperation(_to, _amount, admin, releaseTimestamp);
        emit TLCRequestMint(_to, admin, _amount, releaseTimestamp, mintOperations.length);
        mintOperations.push(op);
    }

    // after a day, admin finalizes mint request by providing the
    // index of the request (visible in the TLCRequestMint accompanying the original request)
    function finalizeMint(uint256 _index) public onlyAdminOrOwner {
        MintOperation memory op = mintOperations[_index];
        require(op.admin == admin); //checks that the requester's adminship has not been revoked
        require(op.releaseTimestamp <= block.timestamp); //checks that enough time has elapsed
        address to = op.to;
        uint256 amount = op.amount;
        delete mintOperations[_index];
        trueUSD.mint(to, amount);
    }

    // Transfer ownership of _child to _newOwner
    // Can be used e.g. to upgrade this TimeLockedController contract.
    function transferChild(Ownable _child, address _newOwner) public onlyOwner {
        emit TLCTransferChild(_child, _newOwner);
        _child.transferOwnership(_newOwner);
    }

    // Transfer ownership of a contract from trueUSD
    // to this TimeLockedController. Can be used e.g. to reclaim balance sheet
    // in order to transfer it to an upgraded TrueUSD contract.
    function requestReclaim(Ownable _other) public onlyOwner {
        emit TLCRequestReclaim(_other);
        trueUSD.reclaimContract(_other);
    }

    // Change the minimum and maximum amounts that TrueUSD users can
    // burn to newMin and newMax
    function changeBurnBounds(uint256 _min, uint256 _max) public onlyOwner {
        emit TLCChangeBurnBounds(_min, _max);
        trueUSD.changeBurnBounds(_min, _max);
    }

    // Change the transaction fees charged on transfer/mint/burn
    function changeStakingFees(uint256 _transferFeeNumerator,
                               uint256 _transferFeeDenominator,
                               uint256 _mintFeeNumerator,
                               uint256 _mintFeeDenominator,
                               uint256 _mintFeeFlat,
                               uint256 _burnFeeNumerator,
                               uint256 _burnFeeDenominator,
                               uint256 _burnFeeFlat) public onlyOwner {
        emit TLCChangeStakingFees(_transferFeeNumerator,
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
    function changeStaker(address _newStaker) public onlyOwner {
        emit TLCChangeStaker(_newStaker);
        trueUSD.changeStaker(_newStaker);
    }

    // Future BurnableToken calls to trueUSD will be delegated to _delegate
    function delegateToNewContract(DelegateBurnable _delegate) public onlyOwner {
        emit TLCDelegateToNewContract(_delegate);
        trueUSD.delegateToNewContract(_delegate);
    }

    // Incoming delegate* calls from _source will be accepted by trueUSD
    function setDelegatedFrom(address _source) public onlyOwner {
        emit TLCSetDelegatedFrom(_source);
        trueUSD.setDelegatedFrom(_source);
    }

    // Update this contract's trueUSD pointer to newContract (e.g. if the
    // contract is upgraded)
    function setTrueUSD(TrueUSD _newContract) public onlyOwner {
        emit TLCSetTrueUSD(_newContract);
        trueUSD = _newContract;
    }

    // change trueUSD's name and symbol
    function changeTokenName(string _name, string _symbol) public onlyOwner {
        emit TLCChangeTokenName(_name, _symbol);
        trueUSD.changeTokenName(_name, _symbol);
    }

    // Replace the current admin with newAdmin. This should be rare (e.g. if admin
    // is compromised), and will invalidate all pending mint operations (including
    // any the owner may have made and not yet finalized)
    function transferAdminship(address _newAdmin) public onlyOwner {
        require(_newAdmin != address(0));
        emit TLCTransferAdminship(admin, _newAdmin);
        admin = _newAdmin;
    }

    // Swap out TrueUSD's address lists
    function setLists(AddressList _canReceiveMintWhiteList, AddressList _canBurnWhiteList, AddressList _blackList, AddressList _noFeesList) onlyOwner public {
        trueUSD.setLists(_canReceiveMintWhiteList, _canBurnWhiteList, _blackList);
        trueUSD.setNoFeesList(_noFeesList);
    }

    // Update a whitelist/blacklist
    function updateList(address _list, address _entry, bool _flag) public onlyAdminOrOwner {
        AddressList(_list).changeList(_entry, _flag);
    }

    // Rename a whitelist/blacklist
    function renameList(address _list, string _name) public onlyAdminOrOwner {
        NamableAddressList(_list).changeName(_name);
    }

    // Claim ownership of an arbitrary Claimable contract
    function issueClaimOwnership(address _other) public onlyAdminOrOwner {
        Claimable other = Claimable(_other);
        other.claimOwnership();
    }

    // Change the delay imposed on admin-initiated mint requests
    function changeMintDelay(uint256 _newDelay) public onlyOwner {
        mintDelay = _newDelay;
        emit TLCChangeMintDelay(_newDelay);
    }
}
