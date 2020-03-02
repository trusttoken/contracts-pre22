pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";

interface FinancialOpportunity {
    function deposit(address _account, uint _amount) external returns(uint);
    function withdrawAndTransfer(address _from, address _to, uint _amount) external returns(uint);
    function withdrawAll(address _account) external returns(uint, uint);
    function perTokenValue() external view returns(uint);
}


contract TrueRewardBackedToken is CompliantDepositTokenWithHook {
    // Move these to proxy storage
    struct FinancialOpportunityAllocation { address financialOpportunity; uint proportion; }
    mapping(address => FinancialOpportunityAllocation[]) private _trueRewardDistribution;
    mapping (address => mapping (address => uint256)) private _financialOpportunityBalances;
    address public constant IEARN_INTERFACE = 0x151B0E171A7fe3dB4d7B62FdB9Da6eBD1f5167bd;
    address public constant ZERO = 0x0000000000000000000000000000000000000000;
    uint public _totalIearnSupply;

    function iEarnInterfaceAddress() internal view returns (address) {
        return IEARN_INTERFACE;
    }

    function totalIearnSupply() public view returns(uint){
        return _totalIearnSupply;
    }

    function accountTotalLoanBackedBalance(address _account) public view returns (uint) {
        // this works for single opportunity
        return _financialOpportunityBalances[_account][iEarnInterfaceAddress()];
    }

    function trueRewardEnabled(address _address) public view returns (bool) {
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
        if (balance == 0) {
            return;
        }
        approve(iEarnInterfaceAddress(), balance);
        uint yTUSDAmount = FinancialOpportunity(iEarnInterfaceAddress()).deposit(msg.sender, balance);
        // emit some event
        _totalIearnSupply = _totalIearnSupply.add(yTUSDAmount);
        _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()] = _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()].add(yTUSDAmount);
        emit Transfer(ZERO, msg.sender, balance); //confirm that this amount is right
    }

    function disableTrueReward() external {
        require(trueRewardEnabled(msg.sender), "already turned on");
        _disableIearn();
        uint yTUSDAmount;
        uint originalBalance;
        (yTUSDAmount, originalBalance) = FinancialOpportunity(iEarnInterfaceAddress()).withdrawAll(msg.sender);
        _totalIearnSupply = _totalIearnSupply.sub(yTUSDAmount);
        _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()] = 0;
        emit Transfer(msg.sender, ZERO, originalBalance); // This is the last part that might not work
    }

    function totalSupply() public view returns (uint256) {
        uint ratio = FinancialOpportunity(iEarnInterfaceAddress()).perTokenValue();
        uint iEarnSupply = ratio.mul(totalIearnSupply()).div(10 ** 18);
        return totalSupply_.add(iEarnSupply);
    }

    function balanceOf(address _who) public view returns (uint256) {
        if (trueRewardEnabled(_who)) {
            uint ratio = FinancialOpportunity(iEarnInterfaceAddress()).perTokenValue();
            return ratio.mul(accountTotalLoanBackedBalance(_who)).div(10 ** 18);
        }
        return super.balanceOf(_who);
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (senderTrueRewardEnabled) {
            // sender enabled receiver not enabled
            emit Transfer(_from, iEarnInterfaceAddress(), _value);
            emit Transfer(iEarnInterfaceAddress(), ZERO, _value);
            uint yTUSDAmount = FinancialOpportunity(iEarnInterfaceAddress()).withdrawAndTransfer(_from, _to, _value);
            _totalIearnSupply = _totalIearnSupply.sub(yTUSDAmount);
            _financialOpportunityBalances[_to][iEarnInterfaceAddress()] = _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()].sub(yTUSDAmount);
        }
        if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            // sender not enabled receiver enabled
            _setAllowance(_to, iEarnInterfaceAddress(), _value);
            uint yTUSDAmount = FinancialOpportunity(iEarnInterfaceAddress()).deposit(_to, _value);
            _totalIearnSupply = _totalIearnSupply.sub(yTUSDAmount);
            _financialOpportunityBalances[_to][iEarnInterfaceAddress()] = _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()].add(yTUSDAmount);
            emit Transfer(ZERO, _to, _value);
        }
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            return super._transferAllArgs(_from, _to, _value);
        }
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (senderTrueRewardEnabled) {
            // sender enabled receiver not enabled
            emit Transfer(_from, iEarnInterfaceAddress(), _value);
            emit Transfer(iEarnInterfaceAddress(), ZERO, _value);
            uint yTUSDAmount = FinancialOpportunity(iEarnInterfaceAddress()).withdrawAndTransfer(_from, _to, _value);
            _totalIearnSupply = _totalIearnSupply.sub(yTUSDAmount);
            _financialOpportunityBalances[_to][iEarnInterfaceAddress()] = _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()].sub(yTUSDAmount);
        }
        if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            // sender not enabled receiver enabled
            _setAllowance(_to, iEarnInterfaceAddress(), _value);
            uint yTUSDAmount = FinancialOpportunity(iEarnInterfaceAddress()).deposit(_to, _value);
            _totalIearnSupply = _totalIearnSupply.sub(yTUSDAmount);
            _financialOpportunityBalances[_to][iEarnInterfaceAddress()] = _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()].add(yTUSDAmount);
            emit Transfer(ZERO, _to, _value);
        }
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            return super._transferFromAllArgs(_from, _to, _value, _spender);
        }
    }

    function mint(address _to, uint256 _value) public onlyOwner {
        super.mint(_to, _value);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (receiverTrueRewardEnabled) {
            approve(iEarnInterfaceAddress(), _value);
            uint yTUSDAmount = FinancialOpportunity(iEarnInterfaceAddress()).deposit(msg.sender, _value);
            _totalIearnSupply = _totalIearnSupply.add(yTUSDAmount);
            _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()] = _financialOpportunityBalances[msg.sender][iEarnInterfaceAddress()].add(yTUSDAmount);
            emit Transfer(ZERO, msg.sender, _value); //confirm that this amount is right
        }
    }
}
