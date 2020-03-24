pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";
import "../TrueReward/FinancialOpportunity.sol";

contract TrueRewardBackedToken is CompliantDepositTokenWithHook {
    // Move these to proxy storage
    struct FinancialOpportunityAllocation { address financialOpportunity; uint proportion; }
    mapping(address => FinancialOpportunityAllocation[]) private _trueRewardDistribution;
    mapping (address => mapping (address => uint256)) private _financialOpportunityBalances;
    uint public _totalAaveSupply;

    address public constant AAVE_INTERFACE = address(0);
    address public constant RESERVE = 0xf000000000000000000000000000000000000000;

    event TrueRewardEnabled(address _account);
    event TrueRewardDisabled(address _account);

    function drainTrueCurrencyReserve(address _to, uint _value) external onlyOwner {
        _transferAllArgs(RESERVE, _to, _value);
    }

    function convertToTrueCurrencyReserve(uint _value) external onlyOwner {
        uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(RESERVE, _value);
        _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
        // reentrancy
        _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE]
                                                                        [aaveInterfaceAddress()].sub(zTUSDAmount);
        emit Transfer(RESERVE, address(0), _value);
    }

    function convertToZTUSDReserve(uint _value) external onlyOwner {
        uint balance = _getBalance(RESERVE);
        if (balance < _value) {
            return;
        }
        _setAllowance(RESERVE, aaveInterfaceAddress(), _value);
        uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(RESERVE, _value);
        _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
        _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE]
                                                                    [aaveInterfaceAddress()].add(zTUSDAmount);
        emit Transfer(address(0), RESERVE, _value);
    }

    function zTUSDReserveBalance() public view returns (uint) {
        return _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()];
    }

    function aaveInterfaceAddress() public view returns (address) {
        return AAVE_INTERFACE;
    }

    function totalAaveSupply() public view returns(uint) {
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
        require(_trueRewardDistribution[msg.sender].length == 0, "aave already enabled");
        _trueRewardDistribution[msg.sender].push(FinancialOpportunityAllocation(aaveInterfaceAddress(), 100));
    }

    function _disableAave() internal {
        delete _trueRewardDistribution[msg.sender][0];
        _trueRewardDistribution[msg.sender].length--;
    }

    function enableTrueReward() external {
        require(!trueRewardEnabled(msg.sender), "not turned on");
        uint balance = _getBalance(msg.sender);
        if (balance == 0) {
            _enableAave();
            return;
        }
        approve(aaveInterfaceAddress(), balance);
        uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(msg.sender, balance);
        _enableAave();
        // emit some event
        _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
        _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()] = _financialOpportunityBalances
                                                    [msg.sender][aaveInterfaceAddress()].add(zTUSDAmount);
        emit TrueRewardEnabled(msg.sender);
        emit Transfer(address(0), msg.sender, balance); //confirm that this amount is right
    }

    function disableTrueReward() external {
        require(trueRewardEnabled(msg.sender), "already turned on");
        _disableAave();
        uint availableTUSDBalance = balanceOf(msg.sender);
        uint zTUSDWithdrawn = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(msg.sender, availableTUSDBalance);
        _totalAaveSupply = _totalAaveSupply.sub(_financialOpportunityBalances[msg.sender][aaveInterfaceAddress()]);
        _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()] = 0;
        emit TrueRewardDisabled(msg.sender);
        emit Transfer(msg.sender, address(0), zTUSDWithdrawn); // This is the last part that might not work
    }

    function _TUSDToZTUSD(uint _amount) internal view returns (uint) {
        uint ratio = FinancialOpportunity(aaveInterfaceAddress()).perTokenValue();
        return _amount.mul(10 ** 18).div(ratio);
    }

    function _zTUSDToTUSD(uint _amount) internal view returns (uint) {
        uint ratio = FinancialOpportunity(aaveInterfaceAddress()).perTokenValue();
        return ratio.mul(_amount).div(10 ** 18);
    }

    function totalSupply() public view returns (uint256) {
        if (totalAaveSupply() != 0) {
            uint aaveSupply = _zTUSDToTUSD(totalAaveSupply());
            return totalSupply_.add(aaveSupply);
        }
        return super.totalSupply();
    }

    function balanceOf(address _who) public view returns (uint256) {
        if (trueRewardEnabled(_who)) {
            return _zTUSDToTUSD(accountTotalLoanBackedBalance(_who));
        }
        return super.balanceOf(_who);
    }

    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            super._transferAllArgs(_from, _to, _value);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");
        uint valueInZTUSD = _TUSDToZTUSD(_value);
        if (senderTrueRewardEnabled && !receiverTrueRewardEnabled && _value < _getBalance(RESERVE)) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()].add(valueInZTUSD);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(valueInZTUSD);
            _subBalance(RESERVE, _value);
            _addBalance(finalTo, _value);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        } else if (!senderTrueRewardEnabled && receiverTrueRewardEnabled && _value < _zTUSDToTUSD(zTUSDReserveBalance())) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _subBalance(_from, _value);
            _addBalance(RESERVE, _value);
            _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()].sub(valueInZTUSD);
            _financialOpportunityBalances[finalTo][aaveInterfaceAddress()] = _financialOpportunityBalances[finalTo][aaveInterfaceAddress()].add(valueInZTUSD);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        } else if (senderTrueRewardEnabled && receiverTrueRewardEnabled) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(valueInZTUSD);
            _financialOpportunityBalances[finalTo][aaveInterfaceAddress()] = _financialOpportunityBalances[finalTo][aaveInterfaceAddress()].add(valueInZTUSD);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        } else if (senderTrueRewardEnabled) {
            // sender enabled receiver not enabled
            emit Transfer(_from, address(this), _value);
            emit Transfer(address(this), address(0), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(_to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
            // watchout for reentrancy
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(zTUSDAmount);
        } else if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            // sender not enabled receiver enabled
            _setAllowance(_from, aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_from, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value);
        }
    }

    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            super._transferFromAllArgs(_from, _to, _value, _spender);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");
        uint valueInZTUSD = _TUSDToZTUSD(_value);
        if (senderTrueRewardEnabled && !receiverTrueRewardEnabled && _value < _getBalance(RESERVE)) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()].add(valueInZTUSD);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(valueInZTUSD);
            _subBalance(RESERVE, _value);
            _addBalance(finalTo, _value);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        } else if (!senderTrueRewardEnabled && receiverTrueRewardEnabled && _value < _zTUSDToTUSD(zTUSDReserveBalance())) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _subBalance(_from, _value);
            _addBalance(RESERVE, _value);
            _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()].sub(valueInZTUSD);
            _financialOpportunityBalances[finalTo][aaveInterfaceAddress()] = _financialOpportunityBalances[finalTo][aaveInterfaceAddress()].add(valueInZTUSD);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        } else if (senderTrueRewardEnabled && receiverTrueRewardEnabled) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(valueInZTUSD);
            _financialOpportunityBalances[finalTo][aaveInterfaceAddress()] = _financialOpportunityBalances[finalTo][aaveInterfaceAddress()].add(valueInZTUSD);
            emit Transfer(_from, _to, _value);
            if (finalTo != _to) {
                emit Transfer(_to, finalTo, _value);
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_to, _value);
                }
            } else {
                if (hasHook) {
                    TrueCoinReceiver(finalTo).tokenFallback(_from, _value);
                }
            }
        } else if (senderTrueRewardEnabled) {
            // sender enabled receiver not enabled
            emit Transfer(_from, address(this), _value);
            emit Transfer(address(this), address(0), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(_to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
            // watchout for reentrancy
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(zTUSDAmount);
        } else if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            // sender not enabled receiver enabled
            _setAllowance(_from, aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_from, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value);
        }
    }

    function mint(address _to, uint256 _value) public onlyOwner {
        super.mint(_to, _value);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (receiverTrueRewardEnabled) {
            approve(aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_to, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value); //confirm that this amount is right
        }
    }
}
