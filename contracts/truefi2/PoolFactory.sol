// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {Ownable} from "../truefi/common/UpgradeableOwnable.sol";
import {OwnedUpgradeabilityProxy} from "../proxy/OwnedUpgradeabilityProxy.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {ITrueFiPool2} from "./interface/ITrueFiPool2.sol";

contract PoolFactory is Ownable {
    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    // @dev Mapping of ERC20 token's addresses to its pool's addresses
    mapping(address => address) public correspondingPool;

    address public poolImplementation;

    // ======= STORAGE DECLARATION END ===========

    /**
     * @dev Initialize this contract with provided parameters
     * @param _poolImplementation First implementation of TrueFiPool
     */
    function initialize(address _poolImplementation) external initializer {
        Ownable.initialize();

        poolImplementation = _poolImplementation;
    }

    function createPool(address token) public {
        OwnedUpgradeabilityProxy proxy = new OwnedUpgradeabilityProxy();
        proxy.upgradeTo(poolImplementation);
        ITrueFiPool2(address(proxy)).initialize(ERC20(token));
        correspondingPool[token] = address(proxy);
    }
}
