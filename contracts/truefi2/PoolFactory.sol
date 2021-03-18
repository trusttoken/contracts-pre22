// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "../truefi/common/UpgradeableOwnable.sol";
import {OwnedProxyWithReference} from "../proxy/OwnedProxyWithReference.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";
import {IImplementationReference} from "../proxy/interface/IImplementationReference.sol";

contract PoolFactory is Ownable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // @dev Mapping of ERC20 token's addresses to its pool's addresses
    mapping(address => address) public correspondingPool;
    mapping(address => bool) public isPool;

    IImplementationReference public poolImplementationReference;

    // ======= STORAGE DECLARATION END ===========

    /**
     * @dev Event to show creation of the new pool
     * @param token Address of token, for which the pool was created
     * @param pool Address of new pool's proxy
     */
    event PoolCreated(address token, address pool);

    /**
     * @dev Throws if token already has an existing corresponding pool
     * @param token Token to be checked for existing pool
     */
    modifier onlyNotExistingPools(address token) {
        require(correspondingPool[token] == address(0), "PoolFactory: This token already has a corresponding pool");
        _;
    }

    /**
     * @dev Initialize this contract with provided parameters
     * @param _poolImplementationReference First implementation reference of TrueFiPool
     */
    function initialize(IImplementationReference _poolImplementationReference) external initializer {
        Ownable.initialize();

        poolImplementationReference = _poolImplementationReference;
    }

    function createPool(address token) external onlyNotExistingPools(token) {
        OwnedProxyWithReference proxy = new OwnedProxyWithReference();
        proxy.changeImplementationReference(poolImplementationReference);
        ITrueFiPool2(address(proxy)).initialize(ERC20(token));
        proxy.transferProxyOwnership(this.owner());
        correspondingPool[token] = address(proxy);
        isPool[address(proxy)] = true;

        emit PoolCreated(token, address(proxy));
    }
}
