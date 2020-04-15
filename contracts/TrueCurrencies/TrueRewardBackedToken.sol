pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";
import "../TrueReward/FinancialOpportunity.sol";

/**
 * @title TrueRewardBackedToken
 * @dev TrueRewardBackedToken is TrueUSD backed by debt.
 *
 * zTUSD represents an amount of TUSD owed to the zTUSD holder
 * zTUSD is calculated by calling perTokenValue on a financial opportunity
 * zTUSD is not transferrable in that the token itself is never tranferred
 * Rather, we override our transfer functions to account for user balances
 * We assume zTUSD always increases in value
 *
 * This contract uses a reserve holding of TUSD and zTUSD to save on gas costs
 * because calling the financial opportunity deposit() and withdraw() everytime
 * can be expensive.
 *
 * Currently, we only have a single financial opportunity.
 * We plan on upgrading this contract to support a multiple financial opportunity,
 * so some of the code is built to support this
 */
contract TrueRewardBackedToken is CompliantDepositTokenWithHook {

    /* Variables in Proxy Storage:
     * struct FinancialOpportunityAllocation { address financialOpportunity; uint proportion; }
     * mapping(address => FinancialOpportunityAllocation[]) _trueRewardDistribution;
     * mapping (address => mapping (address => uint256)) _financialOpportunityBalances;
    */

    // Reserve is an address which nobody has the private key to
    // Reserves of TUSD and TrueRewardBackedToken are held at this addess
    address public constant RESERVE = 0xf000000000000000000000000000000000000000;
    uint public _totalAaveSupply;
    address public aaveInterfaceAddress_;

    event TrueRewardEnabled(address _account);
    event TrueRewardDisabled(address _account);

    /** @dev return true if TrueReward is enabled for a given address */
    function trueRewardEnabled(address _address) public view returns (bool) {
        return _trueRewardDistribution[_address].length != 0;
    }

    /** @dev set new Aave Interface address */
    function setAaveInterfaceAddress(address _aaveInterfaceAddress) external onlyOwner {
        aaveInterfaceAddress_ = _aaveInterfaceAddress;
    }

    /** @dev return aave financial opportunity address */
    function aaveInterfaceAddress() public view returns (address) {
        return aaveInterfaceAddress_;
    }

    /** @dev get total aave supply in yTUSD */
    function totalAaveSupply() public view returns(uint) {
        return _totalAaveSupply;
    }

    /** @dev get zTUSD reserve balance */
    function zTUSDReserveBalance() public view returns (uint) {
        return _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()];
    }

    /**
     * @dev get total zTUSD balance of a given account
     * this only works for a single opportunity
     */
    function accountTotalLoanBackedBalance(address _account) public view returns (uint) {
        return _financialOpportunityBalances[_account][aaveInterfaceAddress()];
    }

    /*
     * @dev calculate rewards earned since last deposit
     */
    function rewardBalanceOf(address _account) public view returns (uint) {
        uint loanBackedBalance = accountTotalLoanBackedBalance(_account);
        return _zTUSDToTUSD(loanBackedBalance) - loanBackedBalance;
    }

    /**
     * @dev Get total supply of all TUSD backed by debt.
     * This amount includes accrued rewards.
     */
    function totalSupply() public view returns (uint256) {
        if (totalAaveSupply() != 0) {
            uint aaveSupply = _zTUSDToTUSD(totalAaveSupply());
            return totalSupply_.add(aaveSupply);
        }
        return super.totalSupply();
    }

    /**
     * @dev Get balance of TUSD including rewards for an address
     */
    function balanceOf(address _who) public view returns (uint256) {
        if (trueRewardEnabled(_who)) {
            return _zTUSDToTUSD(accountTotalLoanBackedBalance(_who));
        }
        return super.balanceOf(_who);
    }

    /**
     * @dev Utility to convert TUSD value to zTUSD value
     * zTUSD is TUSD backed by TrueRewards debt
     */
    function _TUSDToZTUSD(uint _amount) internal view returns (uint) {
        uint ratio = FinancialOpportunity(aaveInterfaceAddress()).perTokenValue();
        return _amount.mul(10 ** 18).div(ratio);
    }

    /**
     * @dev Utility to convert zTUSD value to TUSD value
     * zTUSD is TUSD backed by TrueRewards debt
     */
    function _zTUSDToTUSD(uint _amount) internal view returns (uint) {
        uint ratio = FinancialOpportunity(aaveInterfaceAddress()).perTokenValue();
        return ratio.mul(_amount).div(10 ** 18);
    }

    /**
     * @dev Withdraw all TrueCurrencies from reserve
     */
    function drainTrueCurrencyReserve(address _to, uint _value) external onlyOwner {
        _transferAllArgs(RESERVE, _to, _value);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is too much money in an opportunity and we want
     * to get more TrueCurrency.
     * This allows us to reduct the cost of transfers 5-10x in/out of opportunities
     */
    function convertToTrueCurrencyReserve(uint _value) external onlyOwner {
        uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(RESERVE, _value);
        _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
        // reentrancy

        _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()]
            .sub(zTUSDAmount);

        emit Transfer(RESERVE, address(0), _value);
    }

    /**
     * @dev Allow this contract to rebalance currency reserves
     * This is called when there is not enough money in an opportunity and we want
     * to get more Opportunity tokens
     * This allows us to reduct the cost of transfers 5-10x in/out of opportunities
     */
    function convertToZTUSDReserve(uint _value) external onlyOwner {
        uint balance = _getBalance(RESERVE);
        if (balance < _value) {
            return;
        }
        _setAllowance(RESERVE, aaveInterfaceAddress(), _value);
        uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(RESERVE, _value);
        _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);

        _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()] = _financialOpportunityBalances[RESERVE][aaveInterfaceAddress()]
            .add(zTUSDAmount);

        emit Transfer(address(0), RESERVE, _value);
    }

    /**
     * @dev enable Aave financial opportunity
     * Set allocation to 100% since we only have a single opportunity
     */
    function _enableAave() internal {
        require(_trueRewardDistribution[msg.sender].length == 0, "already enabled");
        _trueRewardDistribution[msg.sender].push(FinancialOpportunityAllocation(aaveInterfaceAddress(), 100));
    }

    /**
     * @dev disable Aave financial opportunity
     * Set allocation to 0% since we only have a single opportunity
     */
    function _disableAave() internal {
        delete _trueRewardDistribution[msg.sender][0];
        _trueRewardDistribution[msg.sender].length--;
    }

    /**
     * @dev Enable TrueReward and deposit user balance into opportunity.
     */
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
        _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
        _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()] = _financialOpportunityBalances
            [msg.sender][aaveInterfaceAddress()].add(zTUSDAmount);
        emit TrueRewardEnabled(msg.sender);
        emit Transfer(address(0), msg.sender, balance); //confirm that this amount is right
    }

    /**
     * @dev Disable TrueReward and withdraw user balance from opportunity.
     */
    function disableTrueReward() external {
        require(trueRewardEnabled(msg.sender), "already disabled");
        _disableAave();
        uint availableTUSDBalance = balanceOf(msg.sender);
        uint zTUSDWithdrawn = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(msg.sender, availableTUSDBalance);
        _totalAaveSupply = _totalAaveSupply.sub(_financialOpportunityBalances[msg.sender][aaveInterfaceAddress()]);
        _financialOpportunityBalances[msg.sender][aaveInterfaceAddress()] = 0;
        emit TrueRewardDisabled(msg.sender);
        emit Transfer(msg.sender, address(0), zTUSDWithdrawn); // This is the last part that might not work
    }

    /**
     * @dev Transfer helper function for TrueRewardBackedToken
     * Uses reserve float to save gas costs for transactions with value < reserve balance.
     * Case #2 and #3 use reserve balances.
     *
     * There are 6 transfer cases
     *  1. Both sender and reciever are disabled
     *  2. Sender enabled, reciever disabled, value < reserve TUSD balance
     *  3. Sender disabled, reciever enabled, value < reserve zTUSD balance (in TUSD)
     *  4. Both sender and reciever are enabled
     *  5. Sender enabled, reciever disabled, value > reserve TUSD balance
     *  6. Sender disabled, reciever enabled, value > reserve zTUSD balance (in TUSD)
     *
     * When we upgrade to support multiple opportunities, here we also want to check
     * If the transfer is between the same opportunities.
     */
    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        // 1. Both sender and reciever are disabled
        // Exchange is in TUSD -> call the normal transfer function
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            super._transferAllArgs(_from, _to, _value);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");

        // calculate zTUSD balance
        uint valueInZTUSD = _TUSDToZTUSD(_value);

        // 2. Sender enabled, reciever disabled, value < reserve TUSD balance
        // Use reserve balance to transfer so we can save gas
        if (senderTrueRewardEnabled && !receiverTrueRewardEnabled && _value < _getBalance(RESERVE)) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            // use reserve to withdraw from financial opportunity reserve and transfer TUSD to reciever
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
        }
        // 3. Sender disabled, reciever enabled, value < reserve zTUSD balance (in TUSD)
        // Use reserve balance to transfer so we can save gas
        else if (!senderTrueRewardEnabled && receiverTrueRewardEnabled && _value < _zTUSDToTUSD(zTUSDReserveBalance())) {
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
        }
        // 4. Sender and reciever are enabled
        // Here we simply transfer zTUSD from the sender to the reciever
        else if (senderTrueRewardEnabled && receiverTrueRewardEnabled) {
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
        }
        // 5. Sender enabled, reciever disabled, value > reserve TUSD balance
        // Withdraw TUSD from opportunity, send to reciever, and burn zTUSD
        else if (senderTrueRewardEnabled) {
            emit Transfer(_from, address(this), _value); // transfer value to this contract
            emit Transfer(address(this), address(0), _value); // burn value
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress())
                .withdrawTo(_to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
            // watchout for reentrancy
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(zTUSDAmount);
        }
        // 6. Sender disabled, reciever enabled, value > reserve zTUSD balance (in TUSD)
        // Deposit TUSD into opportunity, mint zTUSD, and increase reciever zTUSD balance
        else if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            _setAllowance(_from, aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress())
                .deposit(_from, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), address(this), _value); // mint value
            emit Transfer(address(this), _to, _value); // send value to reciever
        }
    }

    /**
     * @dev TransferFromAll helper function for TrueRewardBackedToken
     * Uses reserve float to save gas costs for transactions with value < reserve balance.
     * Case #2 and #3 use reserve balances.
     *
     * There are 6 transfer cases
     *  1. Both sender and reciever are disabled
     *  2. Sender enabled, reciever disabled, value < reserve TUSD balance
     *  3. Sender disabled, reciever enabled, value < reserve zTUSD balance (in TUSD)
     *  4. Both sender and reciever are enabled
     *  5. Sender enabled, reciever disabled, value > reserve TUSD balance
     *  6. Sender disabled, reciever enabled, value > reserve zTUSD balance (in TUSD)
     *
     * When we upgrade to support multiple opportunities, here we also want to check
     * If the transfer is between the same opportunities.
     */
    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        // 1. Both sender and reciever are disabled -> normal transfer
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            super._transferFromAllArgs(_from, _to, _value, _spender);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");
        // calculate zTUSD value
        uint valueInZTUSD = _TUSDToZTUSD(_value);

        // 2. Sender enabled, reciever disabled, value < reserve TUSD balance
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
        }
        // 3. Sender disabled, reciever enabled, value < reserve zTUSD balance (in TUSD)
        else if (!senderTrueRewardEnabled && receiverTrueRewardEnabled && _value < _zTUSDToTUSD(zTUSDReserveBalance())) {
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
        }
        // 4. Both sender and reciever are enabled
        else if (senderTrueRewardEnabled && receiverTrueRewardEnabled) {
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
        }
        // 5. Sender enabled, reciever disabled, value > reserve TUSD balance
        else if (senderTrueRewardEnabled) {
            emit Transfer(_from, address(this), _value);
            emit Transfer(address(this), address(0), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).withdrawTo(_to, _value);
            _totalAaveSupply = _totalAaveSupply.sub(zTUSDAmount);
            // watchout for reentrancy
            _financialOpportunityBalances[_from][aaveInterfaceAddress()] = _financialOpportunityBalances[_from][aaveInterfaceAddress()].sub(zTUSDAmount);
        }
        // 6. Sender disabled, reciever enabled, value > reserve zTUSD balance (in TUSD)
        else if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            _setAllowance(_from, aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_from, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value); // // mint value
            emit Transfer(address(this), _to, _value); // send value to reciever
        }
    }

    /**
     * @dev mint function for TrueRewardBackedToken
     * Mints TrueUSD backed by debt
     * When we add multiple opportunities, this needs to work for mutliple interfaces
     */
    function mint(address _to, uint256 _value) public onlyOwner {
        super.mint(_to, _value);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        if (receiverTrueRewardEnabled) {
            approve(aaveInterfaceAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(aaveInterfaceAddress()).deposit(_to, _value);
            _totalAaveSupply = _totalAaveSupply.add(zTUSDAmount);
            _financialOpportunityBalances[_to][aaveInterfaceAddress()] = _financialOpportunityBalances[_to][aaveInterfaceAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value);
        }
    }
}
