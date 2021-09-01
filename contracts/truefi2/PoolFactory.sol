// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

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
    using SafeMath for uint256;
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // @dev Mapping of ERC20 token's addresses to its pool's addresses
    mapping(address => address) public pool;
    mapping(address => bool) public isPool;

    // @dev Whitelist for tokens, which can have pools created
    mapping(address => bool) public isAllowed;
    bool public allowAll;

    ImplementationReference public poolImplementationReference;

    address public DEPRECATED__liquidationToken;

    ITrueLender2 public trueLender2;

    ISAFU public safu;

    // @dev Mapping of borrowers to mapping of ERC20 token's addresses to its single borrower pool
    mapping(address => mapping(address => address)) public singleBorrowerPool;
    mapping(address => bool) public isBorrowerWhitelisted;

    /// @dev array of pools officially supported by TrueFi
    ITrueFiPool2[] public supportedPools; //TODO: replace getTVLPools with this

    // ======= STORAGE DECLARATION END ===========

    /**
     * @dev Event to show creation of the new pool
     * @param token Address of token, for which the pool was created
     * @param pool Address of new pool's proxy
     */
    event PoolCreated(address token, address pool);

    /**
     * @dev Event to show creation of the new single borrower pool
     * @param borrower Address of new pool's borrower
     * @param token Address of token, for which the pool was created
     * @param pool Address of new pool's proxy
     */
    event SingleBorrowerPoolCreated(address borrower, address token, address pool);

    /// @dev emit `pool` when officially supporting
    event PoolSupported(ITrueFiPool2 pool);

    /// @dev emit `pool` when officially removing support
    event PoolUnsupported(ITrueFiPool2 pool);

    /**
     * @dev Event to show that token is now allowed/disallowed to have a pool created
     * @param token Address of token
     * @param status New status of allowance
     */
    event AllowedStatusChanged(address token, bool status);

    /**
     * @dev Event to show that borrower is now allowed/disallowed to have a single borrower pool
     * @param borrower Address of borrower
     * @param status New status of allowance
     */
    event BorrowerWhitelistStatusChanged(address borrower, bool status);

    /**
     * @dev Event to show that allowAll status has been changed
     * @param status New status of allowAll
     */
    event AllowAllStatusChanged(bool status);

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
        require(allowAll || isAllowed[token], "PoolFactory: This token is not allowed to have a pool");
        _;
    }

    /**
     * @dev Throws if borrower is not whitelisted for creating new pool
     * @param borrower Address of borrower to be checked in whitelist
     */
    modifier onlyWhitelistedBorrowers(address borrower) {
        require(isBorrowerWhitelisted[borrower], "PoolFactory: This borrower is not allowed to have a pool");
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
     * @dev Deprecate a pool from token lookups without removing it from the factory.
     * Calling this function allows owner to create a replacement pool for the same token.
     */
    function deprecatePool(ITrueFiPool2 legacyPool) external onlyOwner {
        pool[address(legacyPool.token())] = address(0);
    }

    /**
     * @dev Remove a pool from the factory regardless of deprecation status.
     */
    function removePool(ITrueFiPool2 legacyPool) external onlyOwner {
        isPool[address(legacyPool)] = false;
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

        ITrueFiPool2(address(proxy)).initialize(ERC20(token), trueLender2, safu, this.owner());

        emit PoolCreated(token, address(proxy));
    }

    /**
     * @dev Create a new single borrower pool behind proxy. Update new pool's implementation.
     * Transfer ownership of created pool to Factory owner.
     * @param token Address of token which the pool will correspond to.
     */
    function createSingleBorrowerPool(
        address token,
        string memory borrowerName,
        string memory borrowerSymbol
    ) external onlyAllowedTokens(token) onlyWhitelistedBorrowers(msg.sender) {
        require(
            singleBorrowerPool[msg.sender][token] == address(0),
            "PoolFactory: This borrower and token already have a corresponding pool"
        );
        OwnedProxyWithReference proxy = new OwnedProxyWithReference(this.owner(), address(poolImplementationReference));
        singleBorrowerPool[msg.sender][token] = address(proxy);
        isPool[address(proxy)] = true;

        ITrueFiPool2(address(proxy)).singleBorrowerInitialize(
            ERC20(token),
            trueLender2,
            safu,
            this.owner(),
            borrowerName,
            borrowerSymbol
        );

        emit SingleBorrowerPoolCreated(msg.sender, token, address(proxy));
    }

    /**
     * @dev Change token allowed status
     * @param token Address of token to be allowed or disallowed
     * @param status New status of allowance for token
     */
    function allowToken(address token, bool status) external onlyOwner {
        isAllowed[token] = status;
        emit AllowedStatusChanged(token, status);
    }

    /**
     * @dev Change borrower allowance status
     * @param borrower Address of borrower to be allowed or disallowed
     * @param status New status of allowance for borrower
     */
    function whitelistBorrower(address borrower, bool status) external onlyOwner {
        isBorrowerWhitelisted[borrower] = status;
        emit BorrowerWhitelistStatusChanged(borrower, status);
    }

    function isSupportedPool(ITrueFiPool2 _pool) external override view returns (bool) {
        for (uint256 i = 0; i < supportedPools.length; i++) {
            if (supportedPools[i] == _pool) {
                return true;
            }
        }
        return false;
    }

    function getSupportedPools() external override view returns (ITrueFiPool2[] memory) {
        return supportedPools;
    }

    /**
     * @dev Add `_pool` to official support
     */
    function supportPool(ITrueFiPool2 _pool) external onlyOwner {
        //TODO: replace addPoolToTVL with it
        require(isPool[address(_pool)], "PoolFactory: Pool not created by factory");

        for (uint256 i = 0; i < supportedPools.length; i++) {
            require(supportedPools[i] != _pool, "PoolFactory: Pool is already supported");
        }
        supportedPools.push(_pool);
        emit PoolSupported(_pool);
    }

    /**
     * @dev Remove `_pool` from official support
     */
    function unsupportPool(ITrueFiPool2 _pool) external onlyOwner {
        //TODO: replace removePoolFromTVL with it

        for (uint256 i = 0; i < supportedPools.length; i++) {
            if (supportedPools[i] == _pool) {
                supportedPools[i] = supportedPools[supportedPools.length - 1];
                supportedPools.pop();
                emit PoolUnsupported(_pool);
                return;
            }
        }
        revert("PoolFactory: Pool already unsupported");
    }

    /**
     * @dev Change allowAll status
     * @param status New status of allowAll
     */
    function setAllowAll(bool status) external onlyOwner {
        allowAll = status;
        emit AllowAllStatusChanged(status);
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

    /**
     * @dev Calculate total TVL in USD
     * @return _tvl TVL for all supported pools
     */
    function tvl() public view returns (uint256) {
        uint256 _tvl = 0;
        for (uint256 i = 0; i < supportedPools.length; i++) {
            _tvl = _tvl.add(supportedPools[i].oracle().tokenToUsd(supportedPools[i].poolValue()));
        }
        return _tvl;
    }
}
