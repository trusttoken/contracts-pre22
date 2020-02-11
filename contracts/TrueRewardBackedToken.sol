pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";

interface IRewardManager {

}

contract TrueRewardBackedToken is CompliantDepositTokenWithHook {

    function setRewardManager(address _rewardManager) public onlyOwner {
        rewardManager = _rewardManager;
    }

    modifier onlyRewardManager() {
        require(msg.sender == rewardManager, "only reward manager");
        _;
    }

    function backedByCollateral(address _address) internal view {
        return _balanceOfCollateralBackedTokens[_address] != 0;
    }

    /**
    * @dev transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        if (backedByCollateral(msg.sender)) {
            
        }
        return super.transfer(_to, _value);
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        if (backedByCollateral(msg.sender)) {

        }
        return super.transferFrom(_from, _to, _value);
    }

}