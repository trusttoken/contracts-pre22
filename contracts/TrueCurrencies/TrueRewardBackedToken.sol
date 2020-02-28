pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";

interface FinancialOpportunityInterface {
    function deposit(address _account, uint _amount) external returns(uint);
    function withdraw(address _account, uint _amount) external returns(uint);
    function withdrawAll(address _account) external returns(uint);
    function perTokenValue() external returns(uint);
}

contract TrueRewardBackedToken is CompliantDepositTokenWithHook {
    struct FinancialOpportunityAllocation { address financialOpportunity; uint proportion; }
    mapping(address => FinancialOpportunityAllocation[]) private _trueRewardDistribution;
    mapping (address => mapping (address => uint256)) private _financialOpportunityBalances;
    address public constant IEARN_INTERFACE = 0x151B0E171A7fe3dB4d7B62FdB9Da6eBD1f5167bd;
    uint public _totalIearnSupply;

    function totalIearnSupply() public view returns(uint){
        return _totalIearnSupply;
    }

    function accountTotalLoanBackedBalance(address _account) internal view {
        // this works for single opportunity
        return _financialOpportunityBalances[_account][IEARN_INTERFACE];
    }

    function trueRewardEnabled(address _address) internal view  returns (bool) {
        return _trueRewardDistribution[_address].length != 0;
    }

    function _enableIearn() internal {
        require(_trueRewardDistribution[msg.sender].length == 0);
        _trueRewardDistribution[msg.sender].push(FinancialOpportunityAllocation(IEARN_INTERFACE, 1));
    }

    function _disableIearn() internal {
        delete _trueRewardDistribution[msg.sender][0];
        _trueRewardDistribution[msg.sender].length--;
    }

    function enableTrueReward() external {
        require(!trueRewardEnabled(msg.sender), "not turned on");
        _enableIearn();
        uint balance = _getBalance(msg.sender);
        approve(IEARN_INTERFACE, balance);
        uint yTUSDAmount = FinancialOpportunityInterface(IEARN_INTERFACE).deposit(msg.sender, balance);
        // emit some event
        _totalIearnSupply = _totalIearnSupply.add(yTUSDAmount);
        _financialOpportunityBalances[msg.sender][IEARN_INTERFACE] = _financialOpportunityBalances[msg.sender][IEARN_INTERFACE].add(yTUSDAmount);
    }

    function disableTrueReward() external {
        require(trueRewardEnabled(msg.sender), "already turned on");
        _disableIearn();
        // should this fail right now?
        FinancialOpportunityInterface(IEARN_INTERFACE).withdrawAll(msg.sender);
    }

    function balanceOf(address _who) public view returns (uint256) {
        if (trueRewardEnabled(_who)) {
            uint ratio = FinancialOpportunityInterface(IEARN_INTERFACE).perTokenValue();
            return ratio.mul(accountTotalLoanBackedBalance(_who));
        }
        return super.balanceOf(_who);
    }

    /**
    * @dev transfer token for a specified address
    * @param _to The address to transfer to.
    * @param _value The amount to be transferred.
    */
    function transfer(address _to, uint256 _value) public returns (bool) {
        bool senderTrueRewardEnabled = trueRewardEnabled(msg.sender);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (senderTrueRewardEnabled) {
            FinancialOpportunityInterface(IEARN_INTERFACE).withdraw(_to, _value);
        }
        if (receiverTrueRewardEnabled & !senderTrueRewardEnabled) { //???
            FinancialOpportunityInterface(IEARN_INTERFACE).deposit(_to, _value);
        }
        if (!senderTrueRewardEnabled & !receiverTrueRewardEnabled) {
            return super.transfer(_to, _value);
        }
    }

    /**
     * @dev Transfer tokens from one address to another
     * @param _from address The address which you want to send tokens from
     * @param _to address The address which you want to transfer to
     * @param _value uint256 the amount of tokens to be transferred
     */
    function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
        bool senderTrueRewardEnabled = trueRewardEnabled(msg.sender);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (trueRewardTurnedOn(_from)) {

        }
        return super.transferFrom(_from, _to, _value);
    }


}