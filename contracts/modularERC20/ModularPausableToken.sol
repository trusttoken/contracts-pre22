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
    event GlobalPauseSet(address newGlobalPause);

    /**
    * @dev Modifier to make a function callable only when the contract is not paused.
    */
    modifier whenNotPaused() {
        require(!paused);
        _;
    }

    /**
    * @dev Modifier to make a function callable only when the contract is paused.
    */
    modifier whenPaused() {
        require(paused);
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
    modifier notOnSupportedChain() {
        require(!globalPause.AllTokenPaused(), "All tokens paused");
        require(globalPause.SupportedFork(), "This is a not the supported Chain");
        _;
    }

    function setGlobalPause(address _newGlobalPause) external onlyOwner {
        globalPause = GlobalPause(_newGlobalPause);
        emit GlobalPauseSet(_newGlobalPause);
    }
    
    function transferAllArgs(address _from, address _to, uint256 _value) internal whenNotPaused notOnSupportedChain {
        super.transferAllArgs(_from, _to, _value);
    }

    function transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal whenNotPaused notOnSupportedChain {
        super.transferFromAllArgs(_from, _to, _value, _spender);
    }

    function approveAllArgs(address _spender, uint256 _value, address _tokenHolder) internal whenNotPaused notOnSupportedChain {
        super.approveAllArgs(_spender, _value, _tokenHolder);
    }

    function increaseApprovalAllArgs(address _spender, uint256 _addedValue, address _tokenHolder) internal whenNotPaused notOnSupportedChain {
        super.increaseApprovalAllArgs(_spender, _addedValue, _tokenHolder);
    }

    function decreaseApprovalAllArgs(address _spender, uint256 _subtractedValue, address _tokenHolder) internal whenNotPaused notOnSupportedChain {
        super.decreaseApprovalAllArgs(_spender, _subtractedValue, _tokenHolder);
    }

    function burnAllArgs(address _burner, uint256 _value, string _note) internal whenNotPaused notOnSupportedChain {
        super.burnAllArgs(_burner, _value, _note);
    }
}
