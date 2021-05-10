// SPDX-License-Identifier: MIT
// AND COPIED FROM https://github.com/compound-finance/compound-protocol/blob/c5fcc34222693ad5f547b14ed01ce719b5f4b000/contracts/Timelock.sol
// Copyright 2020 Compound Labs, Inc.
// Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
// 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
// 3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

pragma solidity ^0.6.10;

import "@openzeppelin/contracts/math/SafeMath.sol";
import {UpgradeableClaimable} from "../common/UpgradeableClaimable.sol";
import {OwnedUpgradeabilityProxy} from "../proxy/OwnedUpgradeabilityProxy.sol";
import {IPauseableContract} from "../common/interface/IPauseableContract.sol";

contract Timelock is UpgradeableClaimable {
    using SafeMath for uint;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    address public admin;
    address public pendingAdmin;
    uint public delay;

    bool public admin_initialized;

    mapping (bytes32 => bool) public queuedTransactions;

    address public pauser;

    // ======= STORAGE DECLARATION END ============

    uint public constant GRACE_PERIOD = 14 days;
    uint public constant MINIMUM_DELAY = 2 days;
    uint public constant MAXIMUM_DELAY = 30 days;

    event NewAdmin(address indexed newAdmin);
    event NewPauser(address indexed newPauser);
    event NewPendingAdmin(address indexed newPendingAdmin);
    event NewDelay(uint indexed newDelay);
    event EmergencyPause(OwnedUpgradeabilityProxy proxy);
    event PauseStatusChanged(address pauseContract, bool status);
    event CancelTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature,  bytes data, uint eta);
    event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature,  bytes data, uint eta);
    event QueueTransaction(bytes32 indexed txHash, address indexed target, uint value, string signature, bytes data, uint eta);

    /**
     * @dev Initialize sets the addresses of admin and the delay timestamp
     * @param admin_ The address of admin
     * @param delay_ The timestamp of delay for timelock contract
     */
    function initialize(address admin_, uint delay_) external {
        UpgradeableClaimable.initialize(msg.sender);
        require(delay_ >= MINIMUM_DELAY, "Timelock::constructor: Delay must exceed minimum delay.");
        require(delay_ <= MAXIMUM_DELAY, "Timelock::setDelay: Delay must not exceed maximum delay.");

        admin = admin_;
        pauser = admin_;
        delay = delay_;

        emit NewDelay(delay);
        emit NewAdmin(admin);
    }

    receive() external payable { }

    /**
     * @dev Set new pauser address
     * @param _pauser New pauser address
     */
    function setPauser(address _pauser) external {
        if (admin_initialized) {
            require(msg.sender == address(this), "Timelock::setPauser: Call must come from Timelock.");
        } else {
            require(msg.sender == admin, "Timelock::setPauser: First call must come from admin.");
        }
        pauser = _pauser;

        emit NewPauser(_pauser);
    }

    /**
     * @dev Emergency pause a proxy owned by this contract
     * Upgrades a proxy to the zero address in order to emergency pause
     * @param proxy Proxy to upgrade to zero address
     */
    function emergencyPause(OwnedUpgradeabilityProxy proxy) external {
        require(msg.sender == address(this) || msg.sender == pauser, "Timelock::emergencyPause: Call must come from Timelock or pauser.");
        require(address(proxy) != address(this), "Timelock::emergencyPause: Cannot pause Timelock.");
        require(address(proxy) != address(admin), "Timelock:emergencyPause: Cannot pause admin.");
        proxy.upgradeTo(address(0));

        emit EmergencyPause(proxy);
    }

    /**
     * @dev Pause or unpause Pausable contracts.
     * Useful to allow/disallow deposits or certain actions in compromised contracts
     * @param pauseContract New pauser address
     * @param status Pause status
     */
    function setPauseStatus(IPauseableContract pauseContract, bool status) external {
        require(msg.sender == address(this) || msg.sender == pauser, "Timelock::setPauseStatus: Call must come from Timelock or pauser.");
        pauseContract.setPauseStatus(status);

        emit PauseStatusChanged(address(pauseContract), status);
    }

    /**
     * @dev Set the timelock delay to a new timestamp
     * @param delay_ The timestamp of delay for timelock contract
     */
    function setDelay(uint delay_) public {
        require(msg.sender == address(this), "Timelock::setDelay: Call must come from Timelock.");
        require(delay_ >= MINIMUM_DELAY, "Timelock::setDelay: Delay must exceed minimum delay.");
        require(delay_ <= MAXIMUM_DELAY, "Timelock::setDelay: Delay must not exceed maximum delay.");
        delay = delay_;

        emit NewDelay(delay);
    }

    /**
     * @dev Accept the pendingAdmin as the admin address
     */
    function acceptAdmin() public {
        require(msg.sender == pendingAdmin, "Timelock::acceptAdmin: Call must come from pendingAdmin.");
        admin = msg.sender;
        pendingAdmin = address(0);

        emit NewAdmin(admin);
    }

    /**
     * @dev Set the pendingAdmin address to a new address
     * @param pendingAdmin_ The address of the new pendingAdmin
     */
    function setPendingAdmin(address pendingAdmin_) public {
        // allows one time setting of admin for deployment purposes
        if (admin_initialized) {
            require(msg.sender == address(this), "Timelock::setPendingAdmin: Call must come from Timelock.");
        } else {
            require(msg.sender == admin, "Timelock::setPendingAdmin: First call must come from admin.");
            admin_initialized = true;
        }
        pendingAdmin = pendingAdmin_;

        emit NewPendingAdmin(pendingAdmin);
    }

    /**
     * @dev Queue one single proposal transaction
     * @param target The target address for call to be made during proposal execution
     * @param value The value to be passed to the calls made during proposal execution
     * @param signature The function signature to be passed during execution
     * @param data The data to be passed to the individual function call
     * @param eta The current timestamp plus the timelock delay
     */
    function queueTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public returns (bytes32) {
        require(msg.sender == admin, "Timelock::queueTransaction: Call must come from admin.");
        require(eta >= getBlockTimestamp().add(delay), "Timelock::queueTransaction: Estimated execution block must satisfy delay.");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = true;

        emit QueueTransaction(txHash, target, value, signature, data, eta);
        return txHash;
    }

    /**
     * @dev Cancel one single proposal transaction
     * @param target The target address for call to be made during proposal execution
     * @param value The value to be passed to the calls made during proposal execution
     * @param signature The function signature to be passed during execution
     * @param data The data to be passed to the individual function call
     * @param eta The current timestamp plus the timelock delay
     */
    function cancelTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public {
        require(msg.sender == admin, "Timelock::cancelTransaction: Call must come from admin.");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        queuedTransactions[txHash] = false;

        emit CancelTransaction(txHash, target, value, signature, data, eta);
    }

    /**
     * @dev Execute one single proposal transaction
     * @param target The target address for call to be made during proposal execution
     * @param value The value to be passed to the calls made during proposal execution
     * @param signature The function signature to be passed during execution
     * @param data The data to be passed to the individual function call
     * @param eta The current timestamp plus the timelock delay
     */
    function executeTransaction(address target, uint value, string memory signature, bytes memory data, uint eta) public payable returns (bytes memory) {
        require(msg.sender == admin, "Timelock::executeTransaction: Call must come from admin.");

        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        require(queuedTransactions[txHash], "Timelock::executeTransaction: Transaction hasn't been queued.");
        require(getBlockTimestamp() >= eta, "Timelock::executeTransaction: Transaction hasn't surpassed time lock.");
        require(getBlockTimestamp() <= eta.add(GRACE_PERIOD), "Timelock::executeTransaction: Transaction is stale.");

        queuedTransactions[txHash] = false;

        bytes memory callData;

        if (bytes(signature).length == 0) {
            callData = data;
        } else {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        }

        // solhint-disable-next-line avoid-low-level-calls
        (bool success, bytes memory returnData) = target.call{value:value}(callData);
        require(success, "Timelock::executeTransaction: Transaction execution reverted.");

        emit ExecuteTransaction(txHash, target, value, signature, data, eta);

        return returnData;
    }

    /**
     * @dev Get the current block timestamp
     * @return The timestamp of current block
     */
    function getBlockTimestamp() internal view returns (uint) {
        // solium-disable-next-line security/no-block-members
        return block.timestamp;
    }
}
