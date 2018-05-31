pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Basic.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./BalanceSheet.sol";

// Version of OpenZeppelin's BasicToken whose balances mapping has been replaced
// with a separate BalanceSheet contract. Most useful in combination with e.g.
// HasNoContracts because then it can relinquish its balance sheet to a new
// version of the token, removing the need to copy over balances.
/**
 * @title Basic token
 * @dev Basic version of StandardToken, with no allowances.
 */
contract ModularBasicToken is ERC20Basic, Claimable {
    using SafeMath for uint256;

    BalanceSheet public balances;

    uint256 totalSupply_;

    event BalanceSheetSet(address indexed sheet);

    /**
    * @dev claim ownership of the balancesheet contract
    * @param _sheet The address to of the balancesheet to claim.
    */
    function setBalanceSheet(address _sheet) public onlyOwner returns (bool){
        balances = BalanceSheet(_sheet);
        balances.claimOwnership();
        emit BalanceSheetSet(_sheet);
        return true;
    }

    /**
    * @dev total number of tokens in existence
    */
    function totalSupply() public view returns (uint256) {
        return totalSupply_;
    }

    /**
    * @dev transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        transferAllArgs(msg.sender, _to, _value);
        return true;
    }


    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        require(_to != address(0),"to address cannot be 0x0");
        require(_from != address(0),"from address cannot be 0x0");
        require(_value <= balances.balanceOf(_from),"not enough balance to transfer");

        // SafeMath.sub will throw if there is not enough balance.
        balances.subBalance(_from, _value);
        balances.addBalance(_to, _value);
        emit Transfer(_from, _to, _value);
    }

    /**
    * @dev Gets the balance of the specified address.
    * @param _owner The address to query the the balance of.
    * @return An uint256 representing the amount owned by the passed address.
    */
    function balanceOf(address _owner) public view returns (uint256 balance) {
        return balances.balanceOf(_owner);
    }
}
