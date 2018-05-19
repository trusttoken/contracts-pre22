pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/HasNoEther.sol";
import "openzeppelin-solidity/contracts/ownership/HasNoTokens.sol";
import "openzeppelin-solidity/contracts/ownership/Claimable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./TrueUSD.sol";

// This contract allows us to split ownership of the TrueUSD contract (and TrueUSD's Registry)
// into two addresses. One, called the "owner" address, has unfettered control of the TrueUSD contract -
// it can mint new tokens, transfer ownership of the contract, etc. However to make
// extra sure that TrueUSD is never compromised, this owner key will not be used in
// day-to-day operations, allowing it to be stored at a heightened level of security.
// Instead, the owner appoints an "admin" address. The admin will be used in everyday operation,
// but is restricted to performing only a few tasks like updating the Registry and minting
// new tokens. Additionally, the admin can
// only mint new tokens by calling a pair of functions - `requestMint`
// and `finalizeMint` - with (roughly) 24 hours in between the two calls.
// This allows us to watch the blockchain and if we discover the admin has been
// compromised and there are unauthorized operations underway, we can use the owner key
// to replace the admin. Requests initiated by an admin that has since been deposed
// cannot be finalized.
contract TimeLockedController is HasNoEther, HasNoTokens, Claimable {
    using SafeMath for uint256;

    struct MintOperation {
        address to;
        uint256 value;
        address admin;
        uint256 releaseTimestamp;
    }

    uint256 public mintDelay = 1 days;
    address public admin;
    TrueUSD public trueUSD;
    MintOperation[] public mintOperations;

    modifier onlyAdminOrOwner() {
        require(msg.sender == admin || msg.sender == owner);
        _;
    }

    event RequestMint(address indexed to, address indexed admin, uint256 value, uint256 releaseTimestamp, uint256 opIndex);
    event TransferChild(address indexed child, address indexed newOwner);
    event RequestReclaimContract(address indexed other);
    event SetTrueUSD(TrueUSD newContract);
    event TransferAdminship(address indexed previousAdmin, address indexed newAdmin);
    event ChangeMintDelay(uint256 newDelay);

    constructor() public {
        admin = msg.sender;
    }

    // admin initiates a request to mint _value TrueUSD for account _to
    function requestMint(address _to, uint256 _value) public onlyAdminOrOwner {
        uint256 releaseTimestamp = block.timestamp;
        if (msg.sender != owner) {
            releaseTimestamp = releaseTimestamp.add(mintDelay);
        }
        MintOperation memory op = MintOperation(_to, _value, admin, releaseTimestamp);
        emit RequestMint(_to, admin, _value, releaseTimestamp, mintOperations.length);
        mintOperations.push(op);
    }

    // after a day, admin finalizes mint request by providing the
    // index of the request (visible in the RequestMint event accompanying the original request)
    function finalizeMint(uint256 _index) public onlyAdminOrOwner {
        MintOperation memory op = mintOperations[_index];
        require(op.admin == admin); //checks that the requester's adminship has not been revoked
        require(op.releaseTimestamp <= block.timestamp); //checks that enough time has elapsed
        address to = op.to;
        uint256 value = op.value;
        delete mintOperations[_index];
        trueUSD.mint(to, value);
    }

    // Transfer ownership of _child to _newOwner
    // Can be used e.g. to upgrade this TimeLockedController contract.
    function transferChild(Ownable _child, address _newOwner) public onlyOwner {
        emit TransferChild(_child, _newOwner);
        _child.transferOwnership(_newOwner);
    }

    // Transfer ownership of a contract from trueUSD
    // to this TimeLockedController. Can be used e.g. to reclaim balance sheet
    // in order to transfer it to an upgraded TrueUSD contract.
    function requestReclaimContract(Ownable _other) public onlyOwner {
        emit RequestReclaimContract(_other);
        trueUSD.reclaimContract(_other);
    }

    function requestReclaimEther() public onlyOwner {
        trueUSD.reclaimEther(owner);
    }

    function requestReclaimToken(ERC20Basic _token) public onlyOwner {
        trueUSD.reclaimToken(_token, owner);
    }

    // Change the minimum and maximum amounts that TrueUSD users can
    // burn to newMin and newMax
    function setBurnBounds(uint256 _min, uint256 _max) public onlyAdminOrOwner {
        trueUSD.setBurnBounds(_min, _max);
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
        trueUSD.changeStaker(_newStaker);
    }

    // Future BurnableToken calls to trueUSD will be delegated to _delegate
    function delegateToNewContract(DelegateBurnable _delegate) public onlyOwner {
        trueUSD.delegateToNewContract(_delegate);
    }

    // Incoming delegate* calls from _source will be accepted by trueUSD
    function setDelegatedFrom(address _source) public onlyOwner {
        trueUSD.setDelegatedFrom(_source);
    }

    // Update this contract's trueUSD pointer to newContract (e.g. if the
    // contract is upgraded)
    function setTrueUSD(TrueUSD _newContract) public onlyOwner {
        emit SetTrueUSD(_newContract);
        trueUSD = _newContract;
    }

    // change trueUSD's name and symbol
    function changeTokenName(string _name, string _symbol) public onlyOwner {
        trueUSD.changeTokenName(_name, _symbol);
    }

    // Replace the current admin with newAdmin. This should be rare (e.g. if admin
    // is compromised), and will invalidate all pending mint operations (including
    // any the owner may have made and not yet finalized)
    function transferAdminship(address _newAdmin) public onlyOwner {
        require(_newAdmin != address(0));
        emit TransferAdminship(admin, _newAdmin);
        admin = _newAdmin;
    }

    // Swap out TrueUSD's permissions registry
    function setRegistry(Registry _registry) onlyOwner public {
        trueUSD.setRegistry(_registry);
    }

    // Update the registry
    function setAttribute(Registry _registry, address _who, string _attribute, uint256 _value, string _notes) public onlyAdminOrOwner {
        _registry.setAttribute(_who, _attribute, _value, _notes);
    }

    // Claim ownership of an arbitrary Claimable contract
    function issueClaimOwnership(address _other) public onlyAdminOrOwner {
        Claimable other = Claimable(_other);
        other.claimOwnership();
    }

    // Change the delay imposed on admin-initiated mint requests
    function changeMintDelay(uint256 _newDelay) public onlyOwner {
        mintDelay = _newDelay;
        emit ChangeMintDelay(_newDelay);
    }
}
