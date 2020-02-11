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

    function backedByCollateral(address _address) internal view  returns (bool) {
        return _balanceOfLoanBackedTokens[_address] != 0;
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
    function rebalanceTokenCollateralization(address[] memory _financialOpportunities, uint[] memory _distributions) public {
        // TODO work out math
        uint total_distribution;
        for(uint i;i < _distributions.length;i++){
            total_distribution += _distributions[i];
        }
        require(total_distribution <= 100, '');
        uint totalValue = total_distribution * balanceOf(msg.sender) / 100;
        _approveAllArgs(rewardManager, totalValue, msg.sender);

    }

    function debitCollateralBackedTokens(address _account) external {

    }
}