pragma solidity ^0.4.21;

import "../registry/contracts/HasRegistry.sol";
import "./modularERC20/ModularBurnableToken.sol";
import "./modularERC20/ModularMintableToken.sol";

contract ComplianceToken is ModularMintableToken, ModularBurnableToken, HasRegistry {
    // In order to deposit USD and receive newly minted TrueUSD, or to burn TrueUSD to
    // redeem it for USD, users must first go through a KYC process (which includes proving they
    // control their ethereum address using AddressValidation.sol).
    string constant HAS_PASSED_KYC = "hasPassedKYC";
    // Redeeming ("burning") TrueUSD tokens for USD requires a separate flag since
    // users must not only be KYC'ed but must also have bank information on file.
    string constant CAN_BURN = "canBurn";
    // Addresses can also be blacklisted, preventing them from sending or receiving
    // TrueUSD. This can be used to prevent the use of TrueUSD by bad actors in
    // accordance with law enforcement. See [TrueCoin Terms of Use](https://truecoin.com/terms-of-use)
    string constant IS_BLACKLISTED = "isBlacklisted";
    // Only KYC'ed accounts can interact with addresses affiliated with an
    // exchange (using transfer/transferFrom)
    string constant IS_EXCHANGE = "isExchange";

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

    // Destroy the tokens owned by a blacklisted account
    function wipeBlacklistedAccount(address _account) public onlyOwner {
        require(registry.hasAttribute(_account, IS_BLACKLISTED));
        uint256 oldValue = balanceOf(_account);
        balances.setBalance(_account, 0);
        totalSupply_ = totalSupply_.sub(oldValue);
        emit WipeBlacklistedAccount(_account, oldValue);
    }
}
