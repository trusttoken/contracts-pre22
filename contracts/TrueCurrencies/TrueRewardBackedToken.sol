pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";

interface FinancialOpportunity {
    function deposit(address _account, uint _amount) external returns(uint);
    function withdrawTo(address _from, address _to, uint _amount) external returns(uint);
    function withdrawAll(address _account) external returns(uint);
    function perTokenValue() external view returns(uint);
}


contract TrueRewardBackedToken is CompliantDepositTokenWithHook {
    // Move these to proxy storage
    struct FinancialOpportunityAllocation { address financialOpportunity; uint proportion; }
    mapping(address => FinancialOpportunityAllocation[]) private _trueRewardDistribution;
    mapping (address => mapping (address => uint256)) private _financialOpportunityBalances;
    address public constant AAVE_INTERFACE = 0x151B0E171A7fe3dB4d7B62FdB9Da6eBD1f5167bd;
    address public constant ZERO = 0x0000000000000000000000000000000000000000;
    uint public _totalAaveSupply;

    function aaveInterfaceAddress() internal view returns (address) {
        return AAVE_INTERFACE;
    }

    function totalAaveSupply() public view returns(uint){
        return _totalAaveSupply;
    }

    function accountTotalLoanBackedBalance(address _account) public view returns (uint) {
        // this works for single opportunity
        return _financialOpportunityBalances[_account][aaveInterfaceAddress()];
    }

    function trueRewardEnabled(address _address) public view returns (bool) {
        return _trueRewardDistribution[_address].length != 0;
    }

    function _enableAave() internal {
        require(_trueRewardDistribution[msg.sender].length == 0);
        _trueRewardDistribution[msg.sender].push(FinancialOpportunityAllocation(aaveInterfaceAddress(), 1));
    }

    function _disableAave() internal {
        delete _trueRewardDistribution[msg.sender][0];
        _trueRewardDistribution[msg.sender].length--;
    }

    function enableTrueReward() external {
        require(!trueRewardEnabled(msg.sender), "not turned on");
        _enableAave();
        uint balance = _getBalance(msg.sender);
        if (balance == 0) {
            return;
        }
        approve(aaveInterfaceAddress(), balance);
        uint yTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(msg.sender, balance);
        // emit some event
        _totalAaveSupply = _totalAaveSupply.add(yTUSDAmount);
        _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()] = _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()].add(yTUSDAmount);
        emit Transfer(ZERO, msg.sender, balance); //confirm that this amount is right
    }

    function disableTrueReward() external {
        require(trueRewardEnabled(msg.sender), "already turned on");
        _disableAave();
        uint yTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawAll(msg.sender);
        _totalAaveSupply = _totalAaveSupply.sub(yTUSDAmount);
        _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()] = 0;
        emit Transfer(msg.sender, ZERO, yTUSDAmount); // This is the last part that might not work
    }

    function totalSupply() public view returns (uint256) {
        if (totalAaveSupply() != 0) {
            uint ratio = FinancialOpportunity(aaveInterfaceAddress()).perTokenValue();
            uint aaveSupply = ratio.mul(totalAaveSupply()).div(10 ** 18);
            return totalSupply_.add(aaveSupply);
        }
        return super.totalSupply();
    }

    function balanceOf(address _who) public view returns (uint256) {
        if (trueRewardEnabled(_who)) {
            uint ratio = FinancialOpportunity(aaveInterfaceAddress()).perTokenValue();
            return ratio.mul(accountTotalLoanBackedBalance(_who)).div(10 ** 18);
        }
        return super.balanceOf(_who);
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (senderTrueRewardEnabled) {
            // sender enabled receiver not enabled
            emit Transfer(_from, aaveInterfaceAddress(), _value);
            emit Transfer(aaveInterfaceAddress(), ZERO, _value);
            uint yTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(_from, _to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(yTUSDAmount);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(yTUSDAmount);
        }
        if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            // sender not enabled receiver enabled
            _setAllowance(_to, aaveInterfaceAddress(), _value);
            uint yTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(yTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(yTUSDAmount);
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
            emit Transfer(_from, aaveInterfaceAddress(), _value);
            emit Transfer(aaveInterfaceAddress(), ZERO, _value);
            uint yTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(_from, _to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(yTUSDAmount);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(yTUSDAmount);
        }
        if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            // sender not enabled receiver enabled
            _setAllowance(_to, aaveInterfaceAddress(), _value);
            uint yTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(yTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(yTUSDAmount);
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
            approve(aaveInterfaceAddress(), _value);
            uint yTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_to, _value);
            _totalAaveSupply = _totalAaveSupply.add(yTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(yTUSDAmount);
            emit Transfer(ZERO, _to, _value); //confirm that this amount is right
        }
    }
}
