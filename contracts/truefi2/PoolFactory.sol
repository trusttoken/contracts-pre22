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

    address public governance;

    IImplementationReference public poolImplementationReference;

    // ======= STORAGE DECLARATION END ===========

    /**
     * @dev Event to show creation of the new pool
     * @param token Address of token, for which the pool was created
     * @param pool Address of new pool's proxy
     */
    event PoolCreated(address token, address pool);

    /**
     * @dev Initialize this contract with provided parameters
     * @param _poolImplementationReference First implementation reference of TrueFiPool
     * @param _governance Governor alpha address
     */
    function initialize(IImplementationReference _poolImplementationReference, address _governance) external initializer {
        Ownable.initialize();

        poolImplementationReference = _poolImplementationReference;
        governance = _governance;
    }

    function createPool(address token) public {
        OwnedProxyWithReference proxy = new OwnedProxyWithReference();
        proxy.changeImplementationReference(poolImplementationReference);
        ITrueFiPool2(address(proxy)).initialize(ERC20(token));
        proxy.transferProxyOwnership(governance);
        correspondingPool[token] = address(proxy);
        emit PoolCreated(token, address(proxy));
    }
}
