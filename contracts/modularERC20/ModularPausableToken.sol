pragma solidity ^0.4.23;

import "./ModularMintableToken.sol";
import "../utilities/GlobalPause.sol";

/**
 * @title Pausable token
 * @dev MintableToken modified with pausable transfers.
 **/
contract ModularPausableToken is ModularMintableToken {

    event Pause();
    event Unpause();
    event GlobalPauseSet(address indexed newGlobalPause);

    /**
    * @dev Modifier to make a function callable only when the contract is not paused.
    */
    modifier whenNotPaused() {
        require(!paused, "Token Paused");
        _;
    }

    /**
    * @dev Modifier to make a function callable only when the contract is paused.
    */
    modifier whenPaused() {
        require(paused, "Token Not Paused");
        _;
    }

    /**
    * @dev called by the owner to pause, triggers stopped state
    */
    function pause() public onlyOwner whenNotPaused {
        paused = true;
        emit Pause();
    }

    /**
    * @dev called by the owner to unpause, returns to normal state
    */
    function unpause() public onlyOwner whenPaused {
        paused = false;
        emit Unpause();
    }


    //All erc20 transactions are paused when not on the supported fork
    modifier onSupportedChain() {
        globalPause.requireNotPaused();
        _;
    }

    function setGlobalPause(address _newGlobalPause) external onlyOwner {
        globalPause = GlobalPause(_newGlobalPause);
        emit GlobalPauseSet(_newGlobalPause);
    }
    
    function _transferAllArgs(address _from, address _to, uint256 _value) internal whenNotPaused onSupportedChain {
        super._transferAllArgs(_from, _to, _value);
    }

    function _approveAllArgs(address _spender, uint256 _value, address _tokenHolder) internal whenNotPaused onSupportedChain {
        super._approveAllArgs(_spender, _value, _tokenHolder);
    }

    function _increaseApprovalAllArgs(address _spender, uint256 _addedValue, address _tokenHolder) internal whenNotPaused onSupportedChain {
        super._increaseApprovalAllArgs(_spender, _addedValue, _tokenHolder);
    }

    function _decreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address _tokenHolder) internal whenNotPaused onSupportedChain {
        super._decreaseApprovalAllArgs(_spender, _subtractedValue, _tokenHolder);
    }

    function _burnAllArgs(address _burner, uint256 _value) internal whenNotPaused onSupportedChain {
        super._burnAllArgs(_burner, _value);
    }
}
