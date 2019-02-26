pragma solidity ^0.4.23;

import "./CompliantToken.sol";
import "./TrueCoinReceiver.sol";

contract CompliantDepositTokenWithHook is CompliantToken {

    bytes32 constant IS_REGISTERED_CONTRACT = "isRegisteredContract";
    bytes32 constant IS_DEPOSIT_ADDRESS = "isDepositAddress";
    uint256 constant REDEMPTION_ADDRESS_COUNT = 0x100000;

    /**
    * @dev transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        address _from = msg.sender;
        if (uint256(_to) < REDEMPTION_ADDRESS_COUNT) {
            registry.requireCanTransfer(_from, _to);
            _value -= _value % CENT;
            _burnFromAllArgs(_from, _to, _value);
        } else {
            _transferAllArgs(_from, _to, _value);
        }
        return true;
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        if (uint256(_to) < REDEMPTION_ADDRESS_COUNT) {
            registry.requireCanTransferFrom(msg.sender, _from, _to);
            _value -= _value % CENT;
            allowances.subAllowance(_from, msg.sender, _value);
            _burnFromAllArgs(_from, _to, _value);
        } else {
            _transferFromAllArgs(_from, _to, _value, msg.sender);
        }
        return true;
    }

    function _burnFromAllArgs(address _from, address _to, uint256 _value) internal {
        registry.requireCanBurn(_to);
        require(_value >= burnMin, "below min burn bound");
        require(_value <= burnMax, "exceeds max burn bound");
        balances.subBalance(_from, _value);
        emit Transfer(_from, _to, _value);
        totalSupply_ = totalSupply_.sub(_value);
        emit Burn(_to, _value);
        emit Transfer(_to, address(0), _value);
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _sender) internal {
        bool hasHook;
        address originalTo = _to;
        (_to, hasHook) = registry.requireCanTransferFrom(_sender, _from, _to);
        allowance[_from][_sender] = allowance[_from][_sender].sub(_value);
        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(_from, originalTo, _value);
        if (originalTo != _to) {
            emit Transfer(originalTo, _to, _value);
            if (hasHook) {
                TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
            }
        } else {
            if (hasHook) {
                TrueCoinReceiver(_to).tokenFallback(_from, _value);
            }
        }
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool hasHook;
        address originalTo = _to;
        (_to, hasHook) = registry.requireCanTransfer(_from, _to);
        balanceOf[_from] = balanceOf[_from].sub(_value);
        balanceOf[_to] = balanceOf[_to].add(_value);
        emit Transfer(_from, originalTo, _value);
        if (originalTo != _to) {
            emit Transfer(originalTo, _to, _value);
            if (hasHook) {
                TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
            }
        } else {
            if (hasHook) {
                TrueCoinReceiver(_to).tokenFallback(_from, _value);
            }
        }
    }

    function mint(address _to, uint256 _value) public onlyOwner {
        require(_to != address(0), "to address cannot be zero");
        bool hasHook;
        address originalTo = _to;
        (_to, hasHook) = registry.requireCanMint(_to);
        totalSupply_ = totalSupply_.add(_value);
        emit Mint(originalTo, _value);
        emit Transfer(address(0), originalTo, _value);
        if (_to != originalTo) {
            emit Transfer(originalTo, _to, _value);
        }
        balanceOf[_to] = balanceOf[_to].add(_value);
        if (hasHook) {
            if (_to != originalTo) {
                TrueCoinReceiver(_to).tokenFallback(originalTo, _value);
            } else {
                TrueCoinReceiver(_to).tokenFallback(address(0), _value);
            }
        }
    }
}
