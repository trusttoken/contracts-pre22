pragma solidity ^0.4.23;

import "./ModularBurnableToken.sol";

/**
 * @title Mintable token
 * @dev Simple ERC20 Token example, with mintable token creation
 * @dev Issue: * https://github.com/OpenZeppelin/openzeppelin-solidity/issues/120
 * Based on code by TokenMarketNet: https://github.com/TokenMarketNet/ico/blob/master/contracts/MintableToken.sol
 */
contract ModularMintableToken is ModularBurnableToken {
    event Mint(address indexed to, uint256 value);

    /**
     * @dev Function to mint tokens
     * @param _to The address that will receive the minted tokens.
     * @param _value The amount of tokens to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function mint(address _to, uint256 _value) public onlyOwner {
        require(_to != address(0), "to address cannot be zero");
        totalSupply_ = totalSupply_.add(_value);
        balances.addBalance(_to, _value);
        emit Mint(_to, _value);
        emit Transfer(address(0), _to, _value);
    }
}
