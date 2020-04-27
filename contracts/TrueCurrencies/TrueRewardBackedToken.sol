pragma solidity ^0.5.13;

import "./CompliantDepositTokenWithHook.sol";
import "../TrueReward/FinancialOpportunity.sol";

/**
 * @title TrueRewardBackedToken
 * @dev TrueRewardBackedToken is TrueUSD backed by debt
 *
 * Enabling TrueRewards deposits TUSD into a financial opportunity
 * Financial opportunities provide awards over time
 * Awards are reflected in the wallet balance updated block-by-block
 *
 * zTUSD represents an amount of ASSURED TUSD owed to the zTUSD holder
 * yTUSD represents an amount of NON-ASSURED TUSD owed to a yTUSD holder
 * For this contract, we only handle zTUSD (Assured Opportunities)
 *
 * TUSD Amount = zTUSD * financial opportunity perTokenValue()
 * We assume perTokenValue never decreases for assured financial opportunities
 *
 * zTUSD is not transferrable in that the token itself is never tranferred
 * Rather, we override our transfer functions to account for user balances
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

    struct RewardAllocation { address finOp; uint proportion; }
    mapping(address => RewardAllocation[]) _rewardDistribution;
    mapping (address => mapping (address => uint256)) _finOpBalances; 

    */

    // Reserve is an address which nobody has the private key to
    // Reserves of TUSD and TrueRewardBackedToken are held at this addess
    address public constant RESERVE = 0xf000000000000000000000000000000000000000;
    uint public _finOpSupply; // in zTUSD
    address public finOpAddress_;

    event TrueRewardEnabled(address _account);
    event TrueRewardDisabled(address _account);

    /** @dev return true if TrueReward is enabled for a given address */
    function trueRewardEnabled(address _address) public view returns (bool) {
        return _rewardDistribution[_address].length != 0;
    }

    /** @dev set new Financial Opportunity address */
    function setFinOpAddress(address _finOpAddress) external onlyOwner {
        finOpAddress_ = _finOpAddress;
    }

    /** @dev return aave financial opportunity address */
    function finOpAddress() public view returns (address) {
        return finOpAddress_;
    }

    /** @dev get total aave supply in zTUSD */
    function opportunitySupply() public view returns(uint) {
        return _finOpSupply;
    }

    /** @dev get zTUSD reserve balance */
    function zTUSDReserveBalance() public view returns (uint) {
        return _finOpBalances[RESERVE][finOpAddress()];
    }

    /**
     * @dev get total zTUSD balance of a given account
     * this only works for a single opportunity
     */
    function accountTotalLoanBackedBalance(address _account) public view returns (uint) {
        return _finOpBalances[_account][finOpAddress()];
    }

    /*
     * @dev calculate rewards earned since last deposit
     * // todo feewet fix this function
     */
    function rewardBalanceOf(address _account) public view returns (uint) {
        uint loanBackedBalance = accountTotalLoanBackedBalance(_account);
        return _toTUSD(loanBackedBalance) - loanBackedBalance;
    }

    /**
     * @dev Get total supply of all TUSD backed by debt.
     * This amount includes accrued rewards.
     */
    function totalSupply() public view returns (uint256) {
        if (opportunitySupply != 0) {
            uint aaveSupply = _toTUSD(opportunitySupply);
            return totalSupply_.add(aaveSupply);
        }
        return super.totalSupply();
    }

    /**
     * @dev Get balance of TUSD including rewards for an address
     */
    function balanceOf(address _who) public view returns (uint256) {
        if (trueRewardEnabled(_who)) {
            return _toTUSD(accountTotalLoanBackedBalance(_who));
        }
        return super.balanceOf(_who);
    }

    /**
     * @dev Utility to convert TUSD value to zTUSD value
     * zTUSD is TUSD backed by TrueRewards debt
     */
    function _toZTUSD(uint _amount) internal view returns (uint) {
        uint ratio = FinancialOpportunity(finOpAddress()).perTokenValue();
        return _amount.mul(10 ** 18).div(ratio);
    }

    /**
     * @dev Utility to convert zTUSD value to TUSD value
     * zTUSD is TUSD backed by TrueRewards debt
     */
    function _toTUSD(uint _amount) internal view returns (uint) {
        uint ratio = FinancialOpportunity(finOpAddress()).perTokenValue();
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
        uint zTUSDAmount = FinancialOpportunity(finOpAddress()).withdrawTo(RESERVE, _value);
        _finOpSupply = _finOpSupply.sub(zTUSDAmount);
        // reentrancy

        _finOpBalances[RESERVE][finOpAddress()] = _finOpBalances[RESERVE][finOpAddress()]
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
        _setAllowance(RESERVE, finOpAddress(), _value);
        uint zTUSDAmount = FinancialOpportunity(finOpAddress()).deposit(RESERVE, _value);
        _finOpSupply = _finOpSupply.add(zTUSDAmount);

        _finOpBalances[RESERVE][finOpAddress()] = _finOpBalances[RESERVE][finOpAddress()]
            .add(zTUSDAmount);

        emit Transfer(address(0), RESERVE, _value);
    }

    /**
     * @dev enable Aave financial opportunity
     * Set allocation to 100% since we only have a single opportunity
     */
    function _enableFinOp() internal {
        require(_rewardDistribution[msg.sender].length == 0, "already enabled");
        _rewardDistribution[msg.sender].push(
            RewardAllocation(finOpAddress(), 100));
    }

    /**
     * @dev disable Aave financial opportunity
     * Set allocation to 0% since we only have a single opportunity
     */
    function _disableFinOp() internal {
        delete _rewardDistribution[msg.sender][0];
        _rewardDistribution[msg.sender].length--;
    }

    /**
     * @dev Enable TrueReward and deposit user balance into opportunity.
     */
    function enableTrueReward() external {
        require(!trueRewardEnabled(msg.sender), "not turned on");
        uint balance = _getBalance(msg.sender);
        if (balance == 0) {
            _enableFinOp();
            return;
        }
        approve(finOpAddress(), balance);
        uint zTUSDAmount = FinancialOpportunity(
            finOpAddress()).deposit(msg.sender, balance);
        _enableFinOp();
        _finOpSupply = _finOpSupply.add(zTUSDAmount);
        _finOpBalances[msg.sender][finOpAddress()] = _finOpBalances
            [msg.sender][finOpAddress()].add(zTUSDAmount);
        emit TrueRewardEnabled(msg.sender);
        emit Transfer(address(0), msg.sender, balance); //confirm that this amount is right
    }

    /**
     * @dev Disable TrueReward and withdraw user balance from opportunity.
     */
    function disableTrueReward() external {
        require(trueRewardEnabled(msg.sender), "already disabled");
        // get balance
        uint tusdBalance = balanceOf(msg.sender);
        // disable 
        _disableFinOp();
        uint zTUSDWithdrawn = FinancialOpportunity(
            finOpAddress()).withdrawTo(msg.sender, tusdBalance);
        _finOpSupply = _finOpSupply.sub(
            _finOpBalances[msg.sender][finOpAddress()]);
        _finOpBalances[msg.sender][finOpAddress()] = 0;
        emit TrueRewardDisabled(msg.sender);
        emit Transfer(msg.sender, address(0), zTUSDWithdrawn); // This is the last part that might not work
    }

    /**
     * @dev Transfer helper function for TrueRewardBackedToken
     * Uses reserve float to save gas costs for transactions with value < reserve balance.
     * Case #2 and #3 use reserve balances.
     *
     * There are 6 transfer cases
     *  1. Both sender and receiver are disabled
     *  2. Sender enabled, receiver disabled, value < reserve TUSD balance
     *  3. Sender disabled, receiver enabled, value < reserve zTUSD balance (in TUSD)
     *  4. Both sender and receiver are enabled
     *  5. Sender enabled, receiver disabled, value > reserve TUSD balance
     *  6. Sender disabled, receiver enabled, value > reserve zTUSD balance (in TUSD)
     *
     * When we upgrade to support multiple opportunities, here we also want to check
     * If the transfer is between the same opportunities.
     */
    function _transferAllArgs(address _from, address _to, uint256 _value) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        // 1. Both sender and receiver are disabled
        // Exchange is in TUSD -> call the normal transfer function
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            // sender not enabled receiver not enabled
            super._transferAllArgs(_from, _to, _value);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");

        // calculate zTUSD balance
        uint valueInZTUSD = _toZTUSD(_value);

        // 2. Sender enabled, receiver disabled, value < reserve TUSD balance
        // Use reserve balance to transfer so we can save gas
        if (senderTrueRewardEnabled && !receiverTrueRewardEnabled && _value < _getBalance(RESERVE)) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);

            // use reserve to withdraw from financial opportunity reserve and transfer TUSD to receiver
            _finOpBalances[RESERVE][finOpAddress()] = 
                _finOpBalances[RESERVE][finOpAddress()].add(valueInZTUSD);
            _finOpBalances[_from][finOpAddress()] = 
                _finOpBalances[_from][finOpAddress()].sub(valueInZTUSD);

            // update TUSD balances
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
        // 3. Sender disabled, receiver enabled, value < reserve zTUSD balance (in TUSD)
        // Use reserve balance to transfer so we can save gas
        else if (!senderTrueRewardEnabled && receiverTrueRewardEnabled && _value < _toTUSD(zTUSDReserveBalance())) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _subBalance(_from, _value);
            _addBalance(RESERVE, _value);

            _finOpBalances[RESERVE][finOpAddress()] = 
                _finOpBalances[RESERVE][finOpAddress()].sub(valueInZTUSD);
            _finOpBalances[finalTo][finOpAddress()] = 
                _finOpBalances[finalTo][finOpAddress()].add(valueInZTUSD);

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
        // 4. Sender and receiver are enabled
        // Here we simply transfer zTUSD from the sender to the receiver
        else if (senderTrueRewardEnabled && receiverTrueRewardEnabled) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);

            _finOpBalances[_from][finOpAddress()] = 
                _finOpBalances[_from][finOpAddress()].sub(valueInZTUSD);
            _finOpBalances[finalTo][finOpAddress()] = 
                _finOpBalances[finalTo][finOpAddress()].add(valueInZTUSD);

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
        // 5. Sender enabled, receiver disabled, value > reserve TUSD balance
        // Withdraw TUSD from opportunity, send to receiver, and burn zTUSD
        else if (senderTrueRewardEnabled) {
            emit Transfer(_from, address(this), _value); // transfer value to this contract
            emit Transfer(address(this), address(0), _value); // burn value
            uint zTUSDAmount = FinancialOpportunity(finOpAddress())
                .withdrawTo(_to, _value);
            _finOpSupply = _finOpSupply.sub(zTUSDAmount);
            // watchout for reentrancy
            _finOpBalances[_from][finOpAddress()] = 
                _finOpBalances[_from][finOpAddress()].sub(zTUSDAmount);
        }
        // 6. Sender disabled, receiver enabled, value > reserve zTUSD balance (in TUSD)
        // Deposit TUSD into opportunity, mint zTUSD, and increase receiver zTUSD balance
        else if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            _setAllowance(_from, finOpAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(finOpAddress())
                .deposit(_from, _value);
            _finOpSupply = _finOpSupply.add(zTUSDAmount);
            _finOpBalances[_to][finOpAddress()] = 
                _finOpBalances[_to][finOpAddress()].add(zTUSDAmount);
            emit Transfer(address(0), address(this), _value); // mint _value
            emit Transfer(address(this), _to, _value); // send value to receiver
        }
    }

    /**
     * @dev TransferFromAll helper function for TrueRewardBackedToken
     * Uses reserve float to save gas costs for transactions with value < reserve balance.
     * Case #2 and #3 use reserve balances.
     *
     * There are 6 transfer cases
     *  1. Both sender and receiver are disabled
     *  2. Sender enabled, receiver disabled, value < reserve TUSD balance
     *  3. Sender disabled, receiver enabled, value < reserve zTUSD balance (in TUSD)
     *  4. Both sender and receiver are enabled
     *  5. Sender enabled, receiver disabled, value > reserve TUSD balance
     *  6. Sender disabled, receiver enabled, value > reserve zTUSD balance (in TUSD)
     *
     * When we upgrade to support multiple opportunities, here we also want to check
     * If the transfer is between the same opportunities.
     */
    function _transferFromAllArgs(address _from, address _to, uint256 _value, address _spender) internal {
        bool senderTrueRewardEnabled = trueRewardEnabled(_from);
        bool receiverTrueRewardEnabled = trueRewardEnabled(_to);
        // 1. Both sender and receiver are disabled -> normal transfer
        if (!senderTrueRewardEnabled && !receiverTrueRewardEnabled) {
            super._transferFromAllArgs(_from, _to, _value, _spender);
            return;
        }
        require(balanceOf(_from) >= _value, "not enough balance");
        // calculate zTUSD value
        uint valueInZTUSD = _toZTUSD(_value);

        // 2. Sender enabled, receiver disabled, value < reserve TUSD balance
        if (senderTrueRewardEnabled && !receiverTrueRewardEnabled && _value < _getBalance(RESERVE)) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _finOpBalances[RESERVE][finOpAddress()] = _finOpBalances[RESERVE][finOpAddress()].add(valueInZTUSD);
            _finOpBalances[_from][finOpAddress()] = _finOpBalances[_from][finOpAddress()].sub(valueInZTUSD);
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
        // 3. Sender disabled, receiver enabled, value < reserve zTUSD balance (in TUSD)
        else if (!senderTrueRewardEnabled && receiverTrueRewardEnabled && _value < _toTUSD(zTUSDReserveBalance())) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _subBalance(_from, _value);
            _addBalance(RESERVE, _value);
            _finOpBalances[RESERVE][finOpAddress()] = _finOpBalances[RESERVE][finOpAddress()].sub(valueInZTUSD);
            _finOpBalances[finalTo][finOpAddress()] = _finOpBalances[finalTo][finOpAddress()].add(valueInZTUSD);
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
        // 4. Both sender and receiver are enabled
        else if (senderTrueRewardEnabled && receiverTrueRewardEnabled) {
            bool hasHook;
            address finalTo;
            (finalTo, hasHook) = _requireCanTransfer(_from, _to);
            _finOpBalances[_from][finOpAddress()] = _finOpBalances[_from][finOpAddress()].sub(valueInZTUSD);
            _finOpBalances[finalTo][finOpAddress()] = _finOpBalances[finalTo][finOpAddress()].add(valueInZTUSD);
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
        // 5. Sender enabled, receiver disabled, value > reserve TUSD balance
        else if (senderTrueRewardEnabled) {
            emit Transfer(_from, address(this), _value);
            emit Transfer(address(this), address(0), _value);
            uint zTUSDAmount = FinancialOpportunity(finOpAddress()).withdrawTo(_to, _value);
            _finOpSupply = _finOpSupply.sub(zTUSDAmount);
            // watchout for reentrancy
            _finOpBalances[_from][finOpAddress()] = _finOpBalances[_from][finOpAddress()].sub(zTUSDAmount);
        }
        // 6. Sender disabled, receiver enabled, value > reserve zTUSD balance (in TUSD)
        else if (receiverTrueRewardEnabled && !senderTrueRewardEnabled) {
            _setAllowance(_from, finOpAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(finOpAddress()).deposit(_from, _value);
            _finOpSupply = _finOpSupply.add(zTUSDAmount);
            _finOpBalances[_to][finOpAddress()] = _finOpBalances[_to][finOpAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value); // // mint value
            emit Transfer(address(this), _to, _value); // send value to receiver
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
            approve(finOpAddress(), _value);
            uint zTUSDAmount = FinancialOpportunity(finOpAddress()).deposit(_to, _value);
            _finOpSupply = _finOpSupply.add(zTUSDAmount);
            _finOpBalances[_to][finOpAddress()] = _finOpBalances[_to][finOpAddress()].add(zTUSDAmount);
            emit Transfer(address(0), _to, _value);
        }
    }
}
