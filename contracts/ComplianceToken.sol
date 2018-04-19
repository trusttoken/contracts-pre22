pragma solidity ^0.4.18;

import "../registry/contracts/HasRegistry.sol";
import "./modularERC20/ModularBurnableToken.sol";
import "./modularERC20/ModularMintableToken.sol";

contract ComplianceToken is ModularMintableToken, ModularBurnableToken, HasRegistry {
    string constant HAS_PASSED_KYC = "hasPassedKYC"; // allows receiving mint and trading on exchanges
    string constant CAN_BURN = "canBurn"; // allows redeeming tokens
    string constant IS_BLACKLISTED = "isBlacklisted"; // prevents transfer, transferFrom, and burn
    string constant IS_EXCHANGE = "isExchange"; // prevents transfers to/from non-KYC'ed addresses

    event WipeBlacklistedAccount(address indexed account, uint256 balance);

    function burnAllArgs(address _burner, uint256 _value) internal {
        require(registry.hasAttribute(_burner, CAN_BURN));
        require(!registry.hasAttribute(_burner, IS_BLACKLISTED));
        super.burnAllArgs(_burner, _value);
    }

    function mint(address _to, uint256 _amount) onlyOwner public returns (bool) {
        require(registry.hasAttribute(_to, HAS_PASSED_KYC));
        super.mint(_to, _amount);
    }

    // A blacklisted address can't call transferFrom
    function transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        require(!registry.hasAttribute(_spender, IS_BLACKLISTED));
        require(!registry.hasAttribute(_spender, IS_EXCHANGE) || (registry.hasAttribute(_from, HAS_PASSED_KYC) && registry.hasAttribute(_to, HAS_PASSED_KYC)));
        require((!registry.hasAttribute(_to, IS_EXCHANGE) && !registry.hasAttribute(_from, IS_EXCHANGE)) || registry.hasAttribute(_spender, HAS_PASSED_KYC));
        super.transferFromAllArgs(_from, _to, _value, _spender);
    }

    // transfer and transferFrom both call this function, so check blacklist here.
    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        require(!registry.hasAttribute(_from, IS_BLACKLISTED));
        require(!registry.hasAttribute(_to, IS_BLACKLISTED));
        require(!registry.hasAttribute(_to, IS_EXCHANGE) || registry.hasAttribute(_from, HAS_PASSED_KYC));
        require(!registry.hasAttribute(_from, IS_EXCHANGE) || registry.hasAttribute(_to, HAS_PASSED_KYC));
        super.transferAllArgs(_from, _to, _value);
    }

    function wipeBlacklistedAccount(address _account) public onlyOwner {
        require(registry.hasAttribute(_account, IS_BLACKLISTED));
        uint256 oldValue = balanceOf(_account);
        balances.setBalance(_account, 0);
        totalSupply_ = totalSupply_.sub(oldValue);
        emit WipeBlacklistedAccount(_account, oldValue);
    }
}
