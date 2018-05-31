pragma solidity ^0.4.23;

import "./ModularBasicToken.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "./AllowanceSheet.sol";

/**
 * @title Standard ERC20 token
 *
 * @dev Implementation of the basic standard token.
 * @dev https://github.com/ethereum/EIPs/issues/20
 * @dev Based on code by FirstBlood: https://github.com/Firstbloodio/token/blob/master/smart_contract/FirstBloodToken.sol
 */
contract ModularStandardToken is ERC20, ModularBasicToken {
    AllowanceSheet public allowances;

    event AllowanceSheetSet(address indexed sheet);

    /**
    * @dev claim ownership of the AllowanceSheet contract
    * @param _sheet The address to of the AllowanceSheet to claim.
    */
    function setAllowanceSheet(address _sheet) public onlyOwner returns(bool){
        allowances = AllowanceSheet(_sheet);
        allowances.claimOwnership();
        emit AllowanceSheetSet(_sheet);
        return true;
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        transferFromAllArgs(_from, _to, _value, msg.sender);
        return true;
    }

    function transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        require(_value <= allowances.allowanceOf(_from, _spender),"not enough allowance to transfer");

        allowances.subAllowance(_from, _spender, _value);
        transferAllArgs(_from, _to, _value);
    }

    /**
     * @dev Approve the passed address to spend the specified amount of tokens on behalf of msg.sender.
     *
     * Beware that changing an allowance with this method brings the risk that someone may use both the old
     * and the new allowance by unfortunate transaction ordering. One possible solution to mitigate this
     * race condition is to first reduce the spender's allowance to 0 and set the desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     * @param _spender The address which will spend the funds.
     * @param _value The amount of tokens to be spent.
     */
    function approve(address _spender, uint256 _value) public returns (bool) {
        approveAllArgs(_spender, _value, msg.sender);
        return true;
    }

    function approveAllArgs(address _spender, uint256 _value, address _tokenHolder) internal {
        allowances.setAllowance(_tokenHolder, _spender, _value);
        emit Approval(_tokenHolder, _spender, _value);
    }

    /**
     * @dev Function to check the amount of tokens that an owner allowed to a spender.
     * @param _owner address The address which owns the funds.
     * @param _spender address The address which will spend the funds.
     * @return A uint256 specifying the amount of tokens still available for the spender.
     */
    function allowance(address _owner, address _spender) public view returns (uint256) {
        return allowances.allowanceOf(_owner, _spender);
    }

    /**
     * @dev Increase the amount of tokens that an owner allowed to a spender.
     *
     * approve should be called when allowed[_spender] == 0. To increment
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param _spender The address which will spend the funds.
     * @param _addedValue The amount of tokens to increase the allowance by.
     */
    function increaseApproval(address _spender, uint _addedValue) public returns (bool) {
        increaseApprovalAllArgs(_spender, _addedValue, msg.sender);
        return true;
    }

    function increaseApprovalAllArgs(address _spender, uint256 _addedValue, address _tokenHolder) internal {
        allowances.addAllowance(_tokenHolder, _spender, _addedValue);
        emit Approval(_tokenHolder, _spender, allowances.allowanceOf(_tokenHolder, _spender));
    }

    /**
     * @dev Decrease the amount of tokens that an owner allowed to a spender.
     *
     * approve should be called when allowed[_spender] == 0. To decrement
     * allowed value is better to use this function to avoid 2 calls (and wait until
     * the first transaction is mined)
     * From MonolithDAO Token.sol
     * @param _spender The address which will spend the funds.
     * @param _subtractedValue The amount of tokens to decrease the allowance by.
     */
    function decreaseApproval(address _spender, uint _subtractedValue) public returns (bool) {
        decreaseApprovalAllArgs(_spender, _subtractedValue, msg.sender);
        return true;
    }

    function decreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address _tokenHolder) internal {
        uint256 oldValue = allowances.allowanceOf(_tokenHolder, _spender);
        if (_subtractedValue > oldValue) {
            allowances.setAllowance(_tokenHolder, _spender, 0);
        } else {
            allowances.subAllowance(_tokenHolder, _spender, _subtractedValue);
        }
        emit Approval(_tokenHolder, _spender, allowances.allowanceOf(_tokenHolder, _spender));
    }

}
