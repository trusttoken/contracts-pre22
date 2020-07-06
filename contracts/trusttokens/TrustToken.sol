// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./ValTokenWithHook.sol";
import "./ClaimableContract.sol";

/**
 * @title TrustToken
 * @dev The TrustToken contract is a claimable contract where the
 * owner can only mint or transfer ownership. TrustTokens use 8 decimals
 * in order to prevent rewards from getting stuck in the remainder on division.
 * Tolerates dilution to slash stake and accept rewards.
 */
contract TrustToken is ValTokenWithHook, ClaimableContract {
    using SafeMath for uint256;
    Registry registry_;
    uint256 constant MAX_SUPPLY = 145000000000000000;
    /**
     * @dev initialize trusttoken and give ownership to sender
     * This is necessary to set ownership for proxy
     */
    function initialize(Registry _registry) public {
        require(!initalized, "already initalized");
        registry_ = _registry;
        owner_ = msg.sender;
        initalized = true;
    }

    function registry() public view override returns (Registry) {
        return registry_;
    }

    /**
     * @dev mint TRU
     * Can never mint more than MAX_SUPPLY = 1.45 billion
     */
    function mint(address _to, uint256 _amount) external onlyOwner {
        if (totalSupply.add(_amount) <= MAX_SUPPLY) {
            _mint(_to, _amount);
        }
        else {
            revert("Max supply exceeded");
        }
    }

    function decimals() public pure returns (uint8) {
        return 8;
    }

    function rounding() public pure returns (uint8) {
        return 8;
    }

    function name() public pure returns (string memory) {
        return "TrustToken";
    }

    function symbol() public pure returns (string memory) {
        return "TRU";
    }
}
