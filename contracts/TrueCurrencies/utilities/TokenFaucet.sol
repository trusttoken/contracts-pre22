pragma solidity^0.5.13;

import "../HasOwner.sol";
import "../TrueUSD.sol";

contract TokenFaucet {
    struct MintOperation {
        address to;
        uint256 value;
        uint256 requestedBlock;
        uint256 numberOfApproval;
        bool paused;
        mapping(address => bool) approved;
    }

    // same storage as TokenController
    address public owner;
    address public pendingOwner;

    bool initialized;
    uint256 public instantMintThreshold;
    uint256 public ratifiedMintThreshold;
    uint256 public multiSigMintThreshold;

    uint256 public instantMintLimit;
    uint256 public ratifiedMintLimit;
    uint256 public multiSigMintLimit;

    uint256 public instantMintPool;
    uint256 public ratifiedMintPool;
    uint256 public multiSigMintPool;
    address[2] public ratifiedPoolRefillApprovals;

    bool public mintPaused;
    uint256 public mintReqInvalidBeforeThisBlock; //all mint request before this block are invalid
    address public mintKey;
    MintOperation[] public mintOperations; //list of a mint requests

    TrueUSD public token;

    Registry public registry;

    event SetToken(TrueUSD newContract);
    event SetRegistry(Registry indexed registry);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event NewOwnerPending(address indexed currentOwner, address indexed pendingOwner);
    event TransferChild(HasOwner indexed child, address indexed newOwner);
    event MintThresholdChanged(uint instant, uint ratified, uint multiSig);
    event InstantMint(address indexed to, uint256 indexed value, address indexed mintKey);

    function initialize() public {
        require(initialized!=true, "already initalized");
        owner = msg.sender;
        initialized = true;
        emit OwnershipTransferred(address(0), owner);
    }

    function faucet(uint256 _amount) external {
        // set KYC
        registry.setAttributeValue(msg.sender, 0x6861735061737365644b59432f414d4c00000000000000000000000000000000, 1);
        // whitelist trueRewards
        registry.setAttributeValue(msg.sender, 0x6973547275655265776172647357686974656c69737465640000000000000000, 1);
        require(_amount <= instantMintThreshold);
        token.mint(msg.sender, _amount);
        emit InstantMint(msg.sender, _amount, msg.sender);
    }

    function whitelistTrueRewards() external {
        registry.setAttributeValue(msg.sender, 0x6973547275655265776172647357686974656c69737465640000000000000000, 1);
    }

    function setMintThresholds(uint256 _instant, uint256 _ratified, uint256 _multiSig) external onlyOwner {
        require(_instant <= _ratified && _ratified <= _multiSig);
        instantMintThreshold = _instant;
        ratifiedMintThreshold = _ratified;
        multiSigMintThreshold = _multiSig;
        emit MintThresholdChanged(_instant, _ratified, _multiSig);
    }

    /**
    * @dev Throws if called by any account other than the owner.
    */
    modifier onlyOwner() {
        require(msg.sender == owner, "only Owner");
        _;
    }

    /**
    * @dev Modifier throws if called by any account other than the pendingOwner.
    */
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner);
        _;
    }

    /**
    * @dev Allows the current owner to set the pendingOwner address.
    * @param newOwner The address to transfer ownership to.
    */
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit NewOwnerPending(owner, pendingOwner);
    }

    /**
    * @dev Allows the pendingOwner address to finalize the transfer.
    */
    function claimOwnership() external onlyPendingOwner {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /**
    *@dev Claim ownership of an arbitrary HasOwner contract
    */
    function issueClaimOwnership(address _other) public onlyOwner {
        HasOwner other = HasOwner(_other);
        other.claimOwnership();
    }

    /**
    *@dev Transfer ownership of _child to _newOwner.
    Can be used e.g. to upgrade this TokenController contract.
    *@param _child contract that tokenController currently Owns
    *@param _newOwner new owner/pending owner of _child
    */
    function transferChild(HasOwner _child, address _newOwner) external onlyOwner {
        _child.transferOwnership(_newOwner);
        emit TransferChild(_child, _newOwner);
    }

    /**
    *@dev Update this contract's token pointer to newContract (e.g. if the
    contract is upgraded)
    */
    function setToken(TrueUSD _newContract) external onlyOwner {
        token = _newContract;
        emit SetToken(_newContract);
    }

    /**
    *@dev Swap out token's permissions registry
    *@param _registry new registry for token
    */
    function setTokenRegistry(Registry _registry) external onlyOwner {
        token.setRegistry(_registry);
    }

    /**
    *@dev Update this contract's registry pointer to _registry
    */
    function setRegistry(Registry _registry) external onlyOwner {
        registry = _registry;
        emit SetRegistry(registry);
    }

    /**
     * @dev Sets the contract which has permissions to manage truerewards reserve
     * Controls access to reserve functions to allow providing liquidity
     */
    function setOpportunityAddress(address _aaveAddress) external onlyOwner {
        token.setOpportunityAddress(_aaveAddress);
    }


}
