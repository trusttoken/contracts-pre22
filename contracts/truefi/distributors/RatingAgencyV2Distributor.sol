// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";

import {Ownable} from "../common/UpgradeableOwnable.sol";
import {IArbitraryDistributor} from "../interface/IArbitraryDistributor.sol";

/**
 * @title ArbitraryTrueDistributor
 * @notice Distribute TRU to a smart contract
 * @dev Allows for arbitrary claiming of TRU by a farm contract
 *
 * Contracts are registered to receive distributions. Once registered,
 * a farm contract can claim TRU from the distributor.
 * - Owner can withdraw funds in case distribution need to be re-allocated
 */
contract RatingAgencyV2Distributor is IArbitraryDistributor, Ownable {
    using SafeMath for uint256;

    // ================ WARNING ==================
    // ===== THIS CONTRACT IS INITIALIZABLE ======
    // === STORAGE VARIABLES ARE DECLARED BELOW ==
    // REMOVAL OR REORDER OF VARIABLES WILL RESULT
    // ========= IN STORAGE CORRUPTION ===========

    IERC20 public trustToken;
    address public override beneficiary;
    uint256 public override amount;
    uint256 public override remaining;
    mapping(address => bool) public beneficiaries;

    // ======= STORAGE DECLARATION END ============

    event Distributed(uint256 amount);
    event BeneficiaryStatusChanged(address beneficiary, bool status);

    /**
     * @dev Initialize distributor
     * @param _beneficiary Address for distribution
     * @param _trustToken TRU address
     */
    function initialize(address _beneficiary, IERC20 _trustToken) public initializer {
        Ownable.initialize();
        trustToken = _trustToken;
        beneficiary = _beneficiary;
        amount = 500000000000000; // 5M
        remaining = 30000000000000000; // 300M
    }

    /**
     * @dev Only beneficiary can receive TRU
     */
    modifier onlyBeneficiary {
        // prettier-ignore
        require(msg.sender == beneficiary || beneficiaries[msg.sender],
            "ArbitraryDistributor: Only beneficiary can receive tokens");
        _;
    }

    /**
     * @dev Owner can set beneficiary status
     * @param _beneficiary Contract which can claim TRU
     * @param _status Boolean to set whether contract can claim TRU
     */
    function setBeneficiaryStatus(address _beneficiary, bool _status) public onlyOwner {
        beneficiaries[_beneficiary] = _status;
        emit BeneficiaryStatusChanged(_beneficiary, _status);
    }

    /**
     * @dev Distribute arbitrary number of tokens
     * @param _amount Amount of TRU to distribute
     */
    function distribute(uint256 _amount) public override onlyBeneficiary {
        remaining = remaining.sub(_amount);
        require(trustToken.transfer(msg.sender, _amount));

        emit Distributed(_amount);
    }

    /**
     * @dev Withdraw funds (for instance if owner decides to create a new distribution) and end distribution cycle
     */
    function empty() public override onlyOwner {
        remaining = 0;
        require(trustToken.transfer(msg.sender, trustToken.balanceOf(address(this))));
    }
}
