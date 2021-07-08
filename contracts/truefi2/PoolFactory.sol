// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {OwnedProxyWithReference} from "../proxy/OwnedProxyWithReference.sol";
import {ERC20, IERC20} from "../common/UpgradeableERC20.sol";

import {IPoolFactory} from "./interface/IPoolFactory.sol";
import {ITrueFiPool2, I1Inch3} from "./interface/ITrueFiPool2.sol";
import {ITrueLender2} from "./interface/ITrueLender2.sol";
import {ImplementationReference} from "../proxy/ImplementationReference.sol";
import {ISAFU} from "./interface/ISAFU.sol";

/**
 * @title PoolFactory
 * @dev Factory used to create pools for a chosen asset
 * This contract creates a new pool and transfer its ownership to the governance contract
 * Anyone can create a new pool, however the token has to be whitelisted
 * Initially created pools hold the same implementation, which can be changed later on individually
 */
contract PoolFactory is IPoolFactory, UpgradeableClaimable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // @dev Mapping of ERC20 token's addresses to its pool's addresses
    mapping(address => address) public pool;
    mapping(address => bool) public override isPool;

    // @dev Whitelist for tokens, which can have pools created
    mapping(address => bool) public isTokenAllowed;
    bool public allowAllTokens;

    ImplementationReference public poolImplementationReference;

    address public DEPRECATED__liquidationToken;

    ITrueLender2 public trueLender2;

    ISAFU public safu;

    // @dev Mapping of borrowers to mapping of ERC20 token's addresses to its private pools
    mapping(address => mapping(address => address)) public privatePool;
    mapping(address => bool) public isBorrowerAllowed;

    // ======= STORAGE DECLARATION END ===========

    /**
     * @dev Event to show creation of the new pool
     * @param token Address of token, for which the pool was created
     * @param pool Address of new pool's proxy
     */
    event PoolCreated(address token, address pool);

    /**
     * @dev Event to show creation of the new private pool
     * @param borrower Address of new pool's borrower
     * @param token Address of token, for which the pool was created
     * @param pool Address of new pool's proxy
     */
    event PrivatePoolCreated(address borrower, address token, address pool);

    /**
     * @dev Event to show that token is now allowed/disallowed to have a pool created
     * @param token Address of token
     * @param status New status of allowance
     */
    event TokenAllowedStatusChanged(address token, bool status);

    /**
     * @dev Event to show that borrower is now allowed/disallowed to have a private pool
     * @param borrower Address of borrower
     * @param status New status of allowance
     */
    event BorrowerAllowedStatusChanged(address borrower, bool status);

    /**
     * @dev Event to show that allowAllTokens status has been changed
     * @param status New status of allowAllTokens
     */
    event AllowAllTokensStatusChanged(bool status);

    /**
     * @dev Event to show that trueLender was changed
     * @param trueLender2 New instance of ITrueLender2
     */
    event TrueLenderChanged(ITrueLender2 trueLender2);

    /**
     * @dev Emitted when SAFU address is changed
     * @param newSafu New SAFU address
     */
    event SafuChanged(ISAFU newSafu);

    /**
     * @dev Throws if token already has an existing corresponding pool
     * @param token Token to be checked for existing pool
     */
    modifier onlyNotExistingPools(address token) {
        require(pool[token] == address(0), "PoolFactory: This token already has a corresponding pool");
        _;
    }

    /**
     * @dev Throws if token is not whitelisted for creating new pool
     * @param token Address of token to be checked in whitelist
     */
    modifier onlyAllowedTokens(address token) {
        require(allowAllTokens || isTokenAllowed[token], "PoolFactory: This token is not allowed to have a pool");
        _;
    }

    /**
     * @dev Throws if borrower is not whitelisted for creating new pool
     * @param borrower Address of borrower to be checked in whitelist
     */
    modifier onlyAllowedBorrowers(address borrower) {
        require(isBorrowerAllowed[borrower], "PoolFactory: This borrower is not allowed to have a pool");
        _;
    }

    /**
     * @dev Initialize this contract with provided parameters
     * @param _poolImplementationReference First implementation reference of TrueFiPool
     */
    function initialize(
        ImplementationReference _poolImplementationReference,
        ITrueLender2 _trueLender2,
        ISAFU _safu
    ) external initializer {
        UpgradeableClaimable.initialize(msg.sender);

        poolImplementationReference = _poolImplementationReference;
        trueLender2 = _trueLender2;
        safu = _safu;
    }

    /**
     * @dev After TUSD pool is updated to comply with ITrueFiPool2 interface, call this with it's address
     */
    function addLegacyPool(ITrueFiPool2 legacyPool) external onlyOwner {
        pool[address(legacyPool.token())] = address(legacyPool);
        isPool[address(legacyPool)] = true;
    }

    /**
     * @dev Create a new pool behind proxy. Update new pool's implementation.
     * Transfer ownership of created pool to Factory owner.
     * @param token Address of token which the pool will correspond to.
     */
    function createPool(address token) external onlyAllowedTokens(token) onlyNotExistingPools(token) {
        OwnedProxyWithReference proxy = new OwnedProxyWithReference(this.owner(), address(poolImplementationReference));
        pool[token] = address(proxy);
        isPool[address(proxy)] = true;

        ITrueFiPool2(address(proxy)).initialize(ERC20(token), trueLender2, safu, this.owner(), "");

        emit PoolCreated(token, address(proxy));
    }

    /**
     * @dev Create a new private pool behind proxy. Update new pool's implementation.
     * Transfer ownership of created pool to Factory owner.
     * @param token Address of token which the pool will correspond to.
     */
    function createPrivatePool(address token, string memory name) external onlyAllowedTokens(token) onlyAllowedBorrowers(msg.sender) {
        require(
            privatePool[msg.sender][token] == address(0),
            "PoolFactory: This borrower and token already have a corresponding pool"
        );
        OwnedProxyWithReference proxy = new OwnedProxyWithReference(this.owner(), address(poolImplementationReference));
        privatePool[msg.sender][token] = address(proxy);
        isPool[address(proxy)] = true;

        ITrueFiPool2(address(proxy)).initialize(ERC20(token), trueLender2, safu, this.owner(), name);

        emit PrivatePoolCreated(msg.sender, token, address(proxy));
    }

    /**
     * @dev Change token allowed status
     * @param token Address of token to be allowed or disallowed
     * @param status New status of allowance for token
     */
    function whitelistToken(address token, bool status) external onlyOwner {
        isTokenAllowed[token] = status;
        emit TokenAllowedStatusChanged(token, status);
    }

    /**
     * @dev Change borrower allowance status
     * @param borrower Address of borrower to be allowed or disallowed
     * @param status New status of allowance for borrower
     */
    function whitelistBorrower(address borrower, bool status) external onlyOwner {
        isBorrowerAllowed[borrower] = status;
        emit BorrowerAllowedStatusChanged(borrower, status);
    }

    /**
     * @dev Change allowAllTokens status
     * @param status New status of allowAllTokens
     */
    function setAllowAllTokens(bool status) external onlyOwner {
        allowAllTokens = status;
        emit AllowAllTokensStatusChanged(status);
    }

    function setTrueLender(ITrueLender2 _trueLender2) external onlyOwner {
        require(address(_trueLender2) != address(0), "PoolFactory: TrueLender address cannot be set to 0");
        trueLender2 = _trueLender2;
        emit TrueLenderChanged(trueLender2);
    }

    function setSafuAddress(ISAFU _safu) external onlyOwner {
        require(address(_safu) != address(0), "PoolFactory: SAFU address cannot be set to 0");
        safu = _safu;
        emit SafuChanged(_safu);
    }
}
