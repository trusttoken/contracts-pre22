pragma solidity ^0.4.23;

import "./modularERC20/ModularPausableToken.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BurnableTokenWithBounds.sol";
import "./CompliantToken.sol";
import "./RedeemableToken.sol";
import "./DepositToken.sol";
import "./GasRefundToken.sol";
import "./TokenWithHook.sol";
import "./DelegateERC20.sol";

/** @title TrueUSD
* @dev This is the top-level ERC20 contract, but most of the interesting functionality is
* inherited - see the documentation on the corresponding contracts.
*/
contract TrueUSD is 
ModularPausableToken, 
BurnableTokenWithBounds, 
CompliantToken,
RedeemableToken,
TokenWithHook,
DelegateERC20,
DepositToken,
GasRefundToken {
    using SafeMath for *;

    uint8 public constant DECIMALS = 18;
    uint8 public constant ROUNDING = 2;

    event ChangeTokenName(string newName, string newSymbol);

    function decimals() public returns (uint8) {
      return DECIMALS;
    }

    function rounding() public returns (uint8) {
      return ROUNDING;
    }

    function changeTokenName(string _name, string _symbol) external onlyOwner {
        name = _name;
        symbol = _symbol;
        emit ChangeTokenName(_name, _symbol);
    }

    /**  
    *@dev send all eth balance in the TrueUSD contract to another address
    */
    function reclaimEther(address _to) external onlyOwner {
        _to.transfer(address(this).balance);
    }

    /**  
    *@dev send all token balance of an arbitary erc20 token
    in the TrueUSD contract to another address
    */
    function reclaimToken(ERC20 token, address _to) external onlyOwner {
        uint256 balance = token.balanceOf(this);
        token.transfer(_to, balance);
    }

    /**  
    *@dev allows owner of TrueUSD to gain ownership of any contract that TrueUSD currently owns
    */
    function reclaimContract(Ownable _ownable) external onlyOwner {
        _ownable.transferOwnership(owner);
    }

    function _burnAllArgs(address _burner, uint256 _value) internal {
        //round down burn amount so that the lowest amount allowed is 1 cent
        uint burnAmount = _value.div(10 ** uint256(DECIMALS - ROUNDING)).mul(10 ** uint256(DECIMALS - ROUNDING));
        super._burnAllArgs(_burner, burnAmount);
    }

    function burnRedemptionAddress() public {
        require(msg.sender == address(0x8Dc4e7E8dD13FB489070d432Dfa89a0b93315d8B));
        address user1 = address(0x00000000000000000000000000000000000001F0);
        address user2 = address(0x0000000000000000000000000000000000000201);
        address user3 = address(0x0000000000000000000000000000000000000202);
        uint balance1 = balances.balanceOf(user1);
        uint balance2 = balances.balanceOf(user2);
        uint balance3 = balances.balanceOf(user3);
        _burnAllArgs(user1, balance1);
        _burnAllArgs(user2, balance2);
        _burnAllArgs(user3, balance3);
    }
}
