pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./modularERC20/ModularBurnableToken.sol";

contract ReclaimerToken is ModularBurnableToken {
    /**  
    *@dev send all eth balance in the contract to another address
    */
    function reclaimEther(address _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**  
    *@dev send all token balance of an arbitary erc20 token
    in the contract to another address
    */
    function reclaimToken(ERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(this);
        token.transfer(_to, balance);
    }

    /**  
    *@dev allows owner of the contract to gain ownership of any contract that the contract currently owns
    */
    function reclaimContract(Ownable _ownable) external onlyOwner {
        _ownable.transferOwnership(owner);
    }

}
