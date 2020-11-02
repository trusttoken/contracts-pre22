// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IArbitraryDistributor} from "../interface/IArbitraryDistributor.sol";
import {Initializable} from "../upgradeability/Initializable.sol";


/**
 * @title ArbitraryTrueDistributor
 * @notice Distribute TRU to a smart contract
 * @dev Allows for arbitrary claiming of TRU by a farm contract
 *
 * Contracts are registered to receive distributions. Once registered, 
 * a farm contract can claim TRU from the distributor.
 * - Owner can withdraw funds in case distribution need to be re-allocated
 */
contract ArbitraryDistributor is IArbitraryDistributor, Initializable {
    using SafeMath for uint256;

    IERC20 public trustToken;
    address public beneficiary;
    uint256 public override amount;
    uint256 public override remaining;

    function initialize(
        address _beneficiary,
        IERC20 _trustToken,
        uint256 _amount
    ) public initializer {
        trustToken = _trustToken;
        beneficiary = _beneficiary;
        amount = _amount;
        remaining = _amount;
    }

    modifier onlyBeneficiary {
        require(msg.sender == beneficiary, "ArbitraryDistributor: Only beneficiary can distribute tokens");
        _;
    }

    function distribute(uint256 _amount) public override onlyBeneficiary {
        remaining = remaining.sub(_amount);
        require(trustToken.transfer(msg.sender, _amount));
    }
}
