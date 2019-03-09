pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BurnableTokenWithBounds.sol";
import "./CompliantDepositTokenWithHook.sol";
import "./GasRefundToken.sol";
import "./DelegateERC20.sol";

/** @title TrueGBP
* @dev This is the top-level ERC20 contract, but most of the interesting functionality is
* inherited - see the documentation on the corresponding contracts.
*/
contract TrueGBP is 
CompliantDepositTokenWithHook,
BurnableTokenWithBounds, 
GasRefundToken {
    using SafeMath for *;

    uint8 constant DECIMALS = 18;
    uint8 constant ROUNDING = 2;

    function decimals() public pure returns (uint8) {
        return DECIMALS;
    }

    function rounding() public pure returns (uint8) {
        return ROUNDING;
    }

    function name() public pure returns (string) {
        return "TrueGBP";
    }

    function symbol() public pure returns (string) {
        return "TGBP";
    }

    /**  
    *@dev send all eth balance in the TrueGBP contract to another address
    */
    function reclaimEther(address _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**  
    *@dev send all token balance of an arbitary erc20 token
    in the TrueGBP contract to another address
    */
    function reclaimToken(ERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(this);
        token.transfer(_to, balance);
    }

    /**  
    *@dev allows owner of TrueGBP to gain ownership of any contract that TrueGBP currently owns
    */
    function reclaimContract(Ownable _ownable) external onlyOwner {
        _ownable.transferOwnership(owner);
    }

    function canBurn() internal pure returns (bytes32) {
        return "canBurnGBP";
    }
}

