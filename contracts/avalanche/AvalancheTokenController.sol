// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IOwnedUpgradeabilityProxy as OwnedUpgradeabilityProxy} from "../proxy/interface/IOwnedUpgradeabilityProxy.sol";

import {IHasOwner as HasOwner} from "../true-currencies/interface/IHasOwner.sol";
import {ITrueCurrency as TrueCurrency} from "../true-currencies/interface/ITrueCurrency.sol";

/** @title TokenController
 * @dev This contract allows us to split ownership of the TrueCurrency contract
 * into two addresses. One, called the "owner" address, has unfettered control of the TrueCurrency contract -
 * it can mint new tokens, transfer ownership of the contract, etc. However to make
 * extra sure that TrueCurrency is never compromised, this owner key will not be used in
 * day-to-day operations, allowing it to be stored at a heightened level of security.
 * Instead, the owner appoints an various "admin" address.
 * There are 3 different types of admin addresses;  MintKey, MintRatifier, and MintPauser.
 * MintKey can request and revoke mints one at a time.
 * MintPausers can pause individual mints or pause all mints.
 * MintRatifiers can approve and finalize mints with enough approval.

 * There are three levels of mints: instant mint, ratified mint, and multiSig mint. Each have a different threshold
 * and deduct from a different pool.
 * Instant mint has the lowest threshold and finalizes instantly without any ratifiers. Deduct from instant mint pool,
 * which can be refilled by one ratifier.
 * Ratify mint has the second lowest threshold and finalizes with one ratifier approval. Deduct from ratify mint pool,
 * which can be refilled by three ratifiers.
 * MultiSig mint has the highest threshold and finalizes with three ratifier approvals. Deduct from multiSig mint pool,
 * which can only be refilled by the owner.
*/

contract AvalancheTokenController {
    using SafeMath for uint256;

    struct MintOperation {
        address to;
        uint256 value;
        uint256 requestedBlock;
        uint256 numberOfApproval;
        bool paused;
        mapping(address => bool) approved;
    }

    address payable public owner;
    address payable public pendingOwner;

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

    uint8 public constant RATIFY_MINT_SIGS = 1; //number of approvals needed to finalize a Ratified Mint
    uint8 public constant MULTISIG_MINT_SIGS = 3; //number of approvals needed to finalize a MultiSig Mint

    bool public mintPaused;
    uint256 public mintReqInvalidBeforeThisBlock; //all mint request before this block are invalid
    address public mintKey;
    MintOperation[] public mintOperations; //list of a mint requests

    TrueCurrency public token;
    address public registryAdmin;
    mapping(address => bool) public isMintPauser;
    mapping(address => bool) public isMintRatifier;

    bool initialized;

    // paused version of TrueCurrency in Production
    // pausing the contract upgrades the proxy to this implementation
    address public constant PAUSED_IMPLEMENTATION = 0x3c8984DCE8f68FCDEEEafD9E0eca3598562eD291;

    modifier onlyMintKeyOrOwner() {
        require(msg.sender == mintKey || msg.sender == owner, "TokenController: Must be mintKey or owner");
        _;
    }

    modifier onlyMintPauserOrOwner() {
        require(isMintPauser[msg.sender] || msg.sender == owner, "TokenController: Must be pauser or owner");
        _;
    }

    modifier onlyMintRatifierOrOwner() {
        require(isMintRatifier[msg.sender] || msg.sender == owner, "TokenController: Must be ratifier or owner");
        _;
    }

    modifier onlyRegistryAdmin() {
        require(msg.sender == registryAdmin || msg.sender == owner, "TokenController: Must be registry admin or owner");
        _;
    }

    //mint operations by the mintkey cannot be processed on when mints are paused
    modifier mintNotPaused() {
        if (msg.sender != owner) {
            require(!mintPaused, "TokenController: Minting is paused");
        }
        _;
    }
    /// @dev Emitted when ownership of controller was transferred
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    /// @dev Emitted when ownership of controller transfer procedure was started
    event NewOwnerPending(address indexed currentOwner, address indexed pendingOwner);
    /// @dev Emitted when owner was transferred for child contract
    event TransferChild(address indexed child, address indexed newOwner);
    /// @dev Emitted when child ownership was claimed
    event RequestReclaimContract(address indexed other);
    /// @dev Emitted when child token was changed
    event SetToken(TrueCurrency newContract);
    /// @dev Emitted when canBurn status of the `burner` was changed to `canBurn`
    event CanBurn(address burner, bool canBurn);

    /// @dev Emitted when mint was requested
    event RequestMint(address indexed to, uint256 indexed value, uint256 opIndex, address mintKey);
    /// @dev Emitted when mint was finalized
    event FinalizeMint(address indexed to, uint256 indexed value, uint256 opIndex, address mintKey);
    /// @dev Emitted on instant mint
    event InstantMint(address indexed to, uint256 indexed value, address indexed mintKey);

    /// @dev Emitted when mint key was replaced
    event TransferMintKey(address indexed previousMintKey, address indexed newMintKey);
    /// @dev Emitted when mint was ratified
    event MintRatified(uint256 indexed opIndex, address indexed ratifier);
    /// @dev Emitted when mint is revoked
    event RevokeMint(uint256 opIndex);
    /// @dev Emitted when all mining is paused (status=true) or unpaused (status=false)
    event AllMintsPaused(bool status);
    /// @dev Emitted when opIndex mint is paused (status=true) or unpaused (status=false)
    event MintPaused(uint256 opIndex, bool status);
    /// @dev Emitted when mint is approved
    event MintApproved(address approver, uint256 opIndex);
    /// @dev Emitted when fast pause contract is changed
    event FastPauseSet(address _newFastPause);

    /// @dev Emitted when mint threshold changes
    event MintThresholdChanged(uint256 instant, uint256 ratified, uint256 multiSig);
    /// @dev Emitted when mint limits change
    event MintLimitsChanged(uint256 instant, uint256 ratified, uint256 multiSig);
    /// @dev Emitted when instant mint pool is refilled
    event InstantPoolRefilled();
    /// @dev Emitted when instant mint pool is ratified
    event RatifyPoolRefilled();
    /// @dev Emitted when multisig mint pool is ratified
    event MultiSigPoolRefilled();

    /*
    ========================================
    Ownership functions
    ========================================
    */

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "TokenController: Only Owner");
        _;
    }

    /**
     * @dev Modifier throws if called by any account other than the pendingOwner.
     */
    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner);
        _;
    }

    function initialize() external {
        require(!initialized, "already initialized");
        owner = msg.sender;
        initialized = true;
    }

    /**
     * @dev Allows the current owner to set the pendingOwner address.
     * @param newOwner The address to transfer ownership to.
     */
    function transferOwnership(address payable newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit NewOwnerPending(address(owner), address(pendingOwner));
    }

    /**
     * @dev Allows the pendingOwner address to finalize the transfer.
     */
    function claimOwnership() external onlyPendingOwner {
        emit OwnershipTransferred(address(owner), address(pendingOwner));
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /*
    ========================================
    proxy functions
    ========================================
    */

    function transferTrueCurrencyProxyOwnership(address _newOwner) external onlyOwner {
        OwnedUpgradeabilityProxy(address(uint160(address(token)))).transferProxyOwnership(_newOwner);
    }

    function claimTrueCurrencyProxyOwnership() external onlyOwner {
        OwnedUpgradeabilityProxy(address(uint160(address(token)))).claimProxyOwnership();
    }

    function upgradeTrueCurrencyProxyImplTo(address _implementation) external onlyOwner {
        OwnedUpgradeabilityProxy(address(uint160(address(token)))).upgradeTo(_implementation);
    }

    /*
    ========================================
    Minting functions
    ========================================
    */

    /**
     * @dev set the threshold for a mint to be considered an instant mint,
     * ratify mint and multiSig mint. Instant mint requires no approval,
     * ratify mint requires 1 approval and multiSig mint requires 3 approvals
     */
    function setMintThresholds(
        uint256 _instant,
        uint256 _ratified,
        uint256 _multiSig
    ) external onlyOwner {
        require(_instant <= _ratified && _ratified <= _multiSig);
        instantMintThreshold = _instant;
        ratifiedMintThreshold = _ratified;
        multiSigMintThreshold = _multiSig;
        emit MintThresholdChanged(_instant, _ratified, _multiSig);
    }

    /**
     * @dev set the limit of each mint pool. For example can only instant mint up to the instant mint pool limit
     * before needing to refill
     */
    function setMintLimits(
        uint256 _instant,
        uint256 _ratified,
        uint256 _multiSig
    ) external onlyOwner {
        require(_instant <= _ratified && _ratified <= _multiSig);
        instantMintLimit = _instant;
        if (instantMintPool > instantMintLimit) {
            instantMintPool = instantMintLimit;
        }
        ratifiedMintLimit = _ratified;
        if (ratifiedMintPool > ratifiedMintLimit) {
            ratifiedMintPool = ratifiedMintLimit;
        }
        multiSigMintLimit = _multiSig;
        if (multiSigMintPool > multiSigMintLimit) {
            multiSigMintPool = multiSigMintLimit;
        }
        emit MintLimitsChanged(_instant, _ratified, _multiSig);
    }

    /**
     * @dev Ratifier can refill instant mint pool
     */
    function refillInstantMintPool() external onlyMintRatifierOrOwner {
        ratifiedMintPool = ratifiedMintPool.sub(instantMintLimit.sub(instantMintPool));
        instantMintPool = instantMintLimit;
        emit InstantPoolRefilled();
    }

    /**
     * @dev Owner or 3 ratifiers can refill Ratified Mint Pool
     */
    function refillRatifiedMintPool() external onlyMintRatifierOrOwner {
        if (msg.sender != owner) {
            address[2] memory refillApprovals = ratifiedPoolRefillApprovals;
            require(msg.sender != refillApprovals[0] && msg.sender != refillApprovals[1]);
            if (refillApprovals[0] == address(0)) {
                ratifiedPoolRefillApprovals[0] = msg.sender;
                return;
            }
            if (refillApprovals[1] == address(0)) {
                ratifiedPoolRefillApprovals[1] = msg.sender;
                return;
            }
        }
        delete ratifiedPoolRefillApprovals; // clears the whole array
        multiSigMintPool = multiSigMintPool.sub(ratifiedMintLimit.sub(ratifiedMintPool));
        ratifiedMintPool = ratifiedMintLimit;
        emit RatifyPoolRefilled();
    }

    /**
     * @dev Owner can refill MultiSig Mint Pool
     */
    function refillMultiSigMintPool() external onlyOwner {
        multiSigMintPool = multiSigMintLimit;
        emit MultiSigPoolRefilled();
    }

    /**
     * @dev mintKey initiates a request to mint _value for account _to
     * @param _to the address to mint to
     * @param _value the amount requested
     */
    function requestMint(address _to, uint256 _value) external mintNotPaused onlyMintKeyOrOwner {
        MintOperation memory op = MintOperation(_to, _value, block.number, 0, false);
        emit RequestMint(_to, _value, mintOperations.length, msg.sender);
        mintOperations.push(op);
    }

    /**
     * @dev Instant mint without ratification if the amount is less
     * than instantMintThreshold and instantMintPool
     * @param _to the address to mint to
     * @param _value the amount minted
     */
    function instantMint(address _to, uint256 _value) external mintNotPaused onlyMintKeyOrOwner {
        require(_value <= instantMintThreshold, "TokenController: Over the instant mint threshold");
        require(_value <= instantMintPool, "TokenController: Instant mint pool is dry");
        instantMintPool = instantMintPool.sub(_value);
        emit InstantMint(_to, _value, msg.sender);
        token.mint(_to, _value);
    }

    /**
     * @dev ratifier ratifies a request mint. If the number of
     * ratifiers that signed off is greater than the number of
     * approvals required, the request is finalized
     * @param _index the index of the requestMint to ratify
     * @param _to the address to mint to
     * @param _value the amount requested
     */
    function ratifyMint(
        uint256 _index,
        address _to,
        uint256 _value
    ) external mintNotPaused onlyMintRatifierOrOwner {
        MintOperation memory op = mintOperations[_index];
        require(op.to == _to, "TokenController: To address does not match");
        require(op.value == _value, "TokenController: Amount does not match");
        require(!mintOperations[_index].approved[msg.sender], "TokenController: Already approved");
        mintOperations[_index].approved[msg.sender] = true;
        mintOperations[_index].numberOfApproval = mintOperations[_index].numberOfApproval.add(1);
        emit MintRatified(_index, msg.sender);
        if (hasEnoughApproval(mintOperations[_index].numberOfApproval, _value)) {
            finalizeMint(_index);
        }
    }

    /**
     * @dev finalize a mint request, mint the amount requested to the specified address
     * @param _index of the request (visible in the RequestMint event accompanying the original request)
     */
    function finalizeMint(uint256 _index) public mintNotPaused {
        MintOperation memory op = mintOperations[_index];
        address to = op.to;
        uint256 value = op.value;
        if (msg.sender != owner) {
            require(canFinalize(_index));
            _subtractFromMintPool(value);
        }
        delete mintOperations[_index];
        token.mint(to, value);
        emit FinalizeMint(to, value, _index, msg.sender);
    }

    /**
     * assumption: only invoked when canFinalize
     */
    function _subtractFromMintPool(uint256 _value) internal {
        if (_value <= ratifiedMintPool && _value <= ratifiedMintThreshold) {
            ratifiedMintPool = ratifiedMintPool.sub(_value);
        } else {
            multiSigMintPool = multiSigMintPool.sub(_value);
        }
    }

    /**
     * @dev compute if the number of approvals is enough for a given mint amount
     */
    function hasEnoughApproval(uint256 _numberOfApproval, uint256 _value) public view returns (bool) {
        if (_value <= ratifiedMintPool && _value <= ratifiedMintThreshold) {
            if (_numberOfApproval >= RATIFY_MINT_SIGS) {
                return true;
            }
        }
        if (_value <= multiSigMintPool && _value <= multiSigMintThreshold) {
            if (_numberOfApproval >= MULTISIG_MINT_SIGS) {
                return true;
            }
        }
        if (msg.sender == owner) {
            return true;
        }
        return false;
    }

    /**
     * @dev compute if a mint request meets all the requirements to be finalized
     * utility function for a front end
     */
    function canFinalize(uint256 _index) public view returns (bool) {
        MintOperation memory op = mintOperations[_index];
        require(op.requestedBlock > mintReqInvalidBeforeThisBlock, "TokenController: This mint is invalid"); //also checks if request still exists
        require(!op.paused, "TokenController: This mint is paused");
        require(hasEnoughApproval(op.numberOfApproval, op.value), "TokenController: Not enough approvals");
        return true;
    }

    /**
     * @dev revoke a mint request, Delete the mintOperation
     * @param _index of the request (visible in the RequestMint event accompanying the original request)
     */
    function revokeMint(uint256 _index) external onlyMintKeyOrOwner {
        delete mintOperations[_index];
        emit RevokeMint(_index);
    }

    /**
     * @dev get mint operatino count
     * @return mint operation count
     */
    function mintOperationCount() public view returns (uint256) {
        return mintOperations.length;
    }

    /*
    ========================================
    Key management
    ========================================
    */

    /**
     * @dev Replace the current mintkey with new mintkey
     * @param _newMintKey address of the new mintKey
     */
    function transferMintKey(address _newMintKey) external onlyOwner {
        require(_newMintKey != address(0), "TokenController: New mint key cannot be 0x0");
        emit TransferMintKey(mintKey, _newMintKey);
        mintKey = _newMintKey;
    }

    function setRegistryAdmin(address admin) external onlyOwner {
        registryAdmin = admin;
    }

    function setIsMintPauser(address account, bool status) external onlyRegistryAdmin {
        isMintPauser[account] = status;
    }

    function setIsMintRatifier(address account, bool status) external onlyRegistryAdmin {
        isMintRatifier[account] = status;
    }

    /*
    ========================================
    Mint Pausing
    ========================================
    */

    /**
     * @dev invalidates all mint request initiated before the current block
     */
    function invalidateAllPendingMints() external onlyOwner {
        mintReqInvalidBeforeThisBlock = block.number;
    }

    /**
     * @dev pause any further mint request and mint finalizations
     */
    function pauseMints() external onlyMintPauserOrOwner {
        mintPaused = true;
        emit AllMintsPaused(true);
    }

    /**
     * @dev unpause any further mint request and mint finalizations
     */
    function unpauseMints() external onlyOwner {
        mintPaused = false;
        emit AllMintsPaused(false);
    }

    /**
     * @dev pause a specific mint request
     * @param  _opIndex the index of the mint request the caller wants to pause
     */
    function pauseMint(uint256 _opIndex) external onlyMintPauserOrOwner {
        mintOperations[_opIndex].paused = true;
        emit MintPaused(_opIndex, true);
    }

    /**
     * @dev unpause a specific mint request
     * @param  _opIndex the index of the mint request the caller wants to unpause
     */
    function unpauseMint(uint256 _opIndex) external onlyOwner {
        mintOperations[_opIndex].paused = false;
        emit MintPaused(_opIndex, false);
    }

    /*
    ========================================
    set and claim contracts, administrative
    ========================================
    */

    /**
     * @dev Update this contract's token pointer to newContract (e.g. if the
     * contract is upgraded)
     */
    function setToken(TrueCurrency _newContract) external onlyOwner {
        token = _newContract;
        emit SetToken(_newContract);
    }

    /**
     * @dev Claim ownership of an arbitrary HasOwner contract
     */
    function issueClaimOwnership(address _other) public onlyOwner {
        HasOwner other = HasOwner(_other);
        other.claimOwnership();
    }

    /**
     * @dev Transfer ownership of _child to _newOwner.
     * Can be used e.g. to upgrade this TokenController contract.
     * @param _child contract that tokenController currently Owns
     * @param _newOwner new owner/pending owner of _child
     */
    function transferChild(HasOwner _child, address _newOwner) external onlyOwner {
        _child.transferOwnership(_newOwner);
        emit TransferChild(address(_child), _newOwner);
    }

    /**
     * @dev send all ether in token address to the owner of tokenController
     */
    function requestReclaimEther() external onlyOwner {
        token.reclaimEther(owner);
    }

    /**
     * @dev transfer all tokens of a particular type in token address to the
     * owner of tokenController
     * @param _token token address of the token to transfer
     */
    function requestReclaimToken(IERC20 _token) external onlyOwner {
        token.reclaimToken(_token, owner);
    }

    /**
     * @dev pause all pausable actions on TrueCurrency, mints/burn/transfer/approve
     */
    function pauseToken() external virtual onlyOwner {
        OwnedUpgradeabilityProxy(address(uint160(address(token)))).upgradeTo(PAUSED_IMPLEMENTATION);
    }

    /**
     * @dev Change the minimum and maximum amounts that TrueCurrency users can
     * burn to newMin and newMax
     * @param _min minimum amount user can burn at a time
     * @param _max maximum amount user can burn at a time
     */
    function setBurnBounds(uint256 _min, uint256 _max) external onlyOwner {
        token.setBurnBounds(_min, _max);
    }

    /**
     * @dev Owner can send ether balance in contract address
     * @param _to address to which the funds will be send to
     */
    function reclaimEther(address payable _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**
     * @dev Owner can send erc20 token balance in contract address
     * @param _token address of the token to send
     * @param _to address to which the funds will be send to
     */
    function reclaimToken(IERC20 _token, address _to) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        _token.transfer(_to, balance);
    }

    /**
     * @dev Owner can allow address to burn tokens
     * @param burner address of the token that can burn
     * @param canBurn true if account is allowed to burn, false otherwise
     */
    function setCanBurn(address burner, bool canBurn) external onlyRegistryAdmin {
        token.setCanBurn(burner, canBurn);
        emit CanBurn(burner, canBurn);
    }

    /**
     * @dev Set blacklisted status for the account.
     * @param account address to set blacklist flag for
     * @param isBlacklisted blacklist flag value
     */
    function setBlacklisted(address account, bool isBlacklisted) external onlyRegistryAdmin {
        token.setBlacklisted(account, isBlacklisted);
    }
}
