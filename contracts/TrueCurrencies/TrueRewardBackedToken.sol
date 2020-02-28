pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";

interface FinancialOpportunityInterface {
    function deposit(address _account, uint _amount) external returns(uint);
    function withdraw(address _account, uint _amount) external returns(uint);
    function withdrawAll(address _account) external returns(uint);
    function perTokenValue() external returns(uint);
}

contract TrueRewardBackedToken is CompliantDepositTokenWithHook {
    // Move these to proxy storage
    struct FinancialOpportunityAllocation { address financialOpportunity; uint proportion; }
    mapping(address => FinancialOpportunityAllocation[]) private _trueRewardDistribution;
    mapping (address => mapping (address => uint256)) private _financialOpportunityBalances;
    address public constant IEARN_INTERFACE = 0x151B0E171A7fe3dB4d7B62FdB9Da6eBD1f5167bd;
    uint public _totalIearnSupply;

    function iEarnInterfaceAddress() internal view returns (address) {
        return IEARN_INTERFACE;
    }

    function totalIearnSupply() public view returns(uint){
        return _totalIearnSupply;
    }

    function accountTotalLoanBackedBalance(address _account) internal view {
        // this works for single opportunity
        return _financialOpportunityBalances[_account][iEarnInterfaceAddress()];
    }

    function trueRewardEnabled(address _address) internal view  returns (bool) {
        return _trueRewardDistribution[_address].length != 0;
    }

    function _enableIearn() internal {
        require(_trueRewardDistribution[msg.sender].length == 0);
        _trueRewardDistribution[msg.sender].push(FinancialOpportunityAllocation(iEarnInterfaceAddress(), 1));
    }

    function _disableIearn() internal {
        delete _trueRewardDistribution[msg.sender][0];
        _trueRewardDistribution[msg.sender].length--;
    }

    function enableTrueReward() external {
        require(!trueRewardEnabled(msg.sender), "not turned on");
        _enableIearn();
        uint balance = _getBalance(msg.sender);
        approve(iEarnInterfaceAddress(), balance);
        uint yTUSDAmount = FinancialOpportunityInterface(iEarnInterfaceAddress()).deposit(msg.sender, balance);
        // emit some event
        _totalIearnSupply = _totalIearnSupply.add(yTUSDAmount);
        _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()] = _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()].add(yTUSDAmount);
    }

    function disableTrueReward() external {
        require(trueRewardEnabled(msg.sender), "already turned on");
        _disableIearn();
        // should this fail right now?
        FinancialOpportunityInterface(iEarnInterfaceAddress()).withdrawAll(msg.sender);
    }

    function balanceOf(address _who) public view returns (uint256) {
        if (trueRewardEnabled(_who)) {
            uint ratio = FinancialOpportunityInterface(iEarnInterfaceAddress()).perTokenValue();
            return ratio.mul(accountTotalLoanBackedBalance(_who));
        }
        return super.balanceOf(_who);
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(msg.sender);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        // consider the recursive case where interface is also enabled?
        if (senderTrueRewardEnabled) {
            // sender enabled receiver not enabled
            FinancialOpportunityInterface(iEarnInterfaceAddress()).withdraw(_to, _value);
        }
        if (receiverTrueRewardEnabled & !senderTrueRewardEnabled) {
            // sender not enabled receiver enabled
            FinancialOpportunityInterface(iEarnInterfaceAddress()).deposit(_to, _value);
        }
        if (!senderTrueRewardEnabled & !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            return super._transferAllArgs(_from, _to, _value);
        }
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (senderTrueRewardEnabled) {
            FinancialOpportunityInterface(iEarnInterfaceAddress()).withdraw(_to, _value);
        }
        if (!senderTrueRewardEnabled & !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            return super._transferFromAllArgs(_from, _to, _value, _spender);
        }
    }

    function mint(address _to, uint256 _value) public onlyOwner {
        super.mint(_to, _value);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (receiverTrueRewardEnabled) {
            uint balance = _getBalance(msg.sender);
            approve(iEarnInterfaceAddress(), balance);
            uint yTUSDAmount = FinancialOpportunityInterface(iEarnInterfaceAddress()).deposit(msg.sender, balance);
            // emit some event
            _totalIearnSupply = _totalIearnSupply.add(yTUSDAmount);
            _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()] = _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()].add(yTUSDAmount);
        }
    }

}