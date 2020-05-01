import { FinancialOpportunity } from "../TrueReward/FinancialOpportunity.sol";
import { CompliantDepositTokenWithHook } from "./CompliantDepositTokenWithHook.sol";

/**
 * @title CompliantRewardToken
 * @dev Non-transferrable token meant to represent 
 * RewardTokens are TrueCurrencies owed by a financial opportunity
 *
 * -- Overview --
 * RewardTokens are redeemable for an underlying DepositToken.
 * RewardTokens are non-transferrable for compliance purposes, since
 * they represent an asset which might increase in value
 * The caller of depositor is responsible for exchanging their
 * tokens, so we never actually create a new asset, rather just
 * keep accounting of user rewardToken balances
 *
 * -- Financial Opportunity -- 
 * RewardTokens are backed by an underlying financial opportunity
 * Each financial opportunity can accept Token deposits for
 * See FinancialOpportunity.sol
 *
 * -- Mint/Redeem/Burn --
 * To create rewardTokens, we call mintRewardToken with some amount of TUSD
 * To redeem rewardTokens we call redeemRewardToken and recieve TUSD
 * Only the account that has rewardTokens can burn reward tokens. The only
 * time we would want to burn rewardTokens is if the underlying opportunity
 * is no longer redeemable, and we want to wipe the debt.
 *
 *
 * -- Reserve --
 * A reserve of rewardTokens and depositTokens are used to save on gas costs
 * This reserve is accessed via "swap" functions
 * When depositing/redeeming from a FinancialOpportunity, gas costs can be
 * relatively high, so rather than doing this, we can keep a reserve of
 * DepositTokens and RewardTokens, and for small amounts, use these balances
 *
 */
contract RewardToken is CompliantDepositTokenWithHook {

    // move to proxy storage
    mapping(address => FinancialOpportunity) finOps;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;

    address public constant RESERVE = 0xf000000000000000000000000000000000000000;

    event MintRewardToken(address account, uint256 amount, address finOp);
    event RedeemRewardToken(address account, uint256 amount, address finOp);
    event BurnRewardToken(address account, uint256 amount, address finOp);
    event SwapRewardToken(address account, uint256 amount, address finOp);
    event SwapDepositToken(address account, uint256 amount, address finOp);

    /**
     * @dev Only addresses registered in this contract's mapping are valid
     *
     * @param finOp reverts if this finOp is not registered
     */
    modifier validFinOp(address finOp) {
        require(finOp != address(0), "unregisterd opportunity");
        _;
    }

    /**
     * @dev get debt balance of account in rewardToken
     *
     * @param account account to get rewardToken balance of
     * @param finOp financial opportunity
     */
    function rewardTokenBalance(
        address account, 
        address finOp
    ) public validFinOp(finOp) returns (uint256) {
        return finOpBalances[finOp][account];
    }

    /**
     * @dev mint rewardToken for financial opportunity
     *
     * For valid finOp, deposit Token into finOp
     * Update finOpSupply & finOpBalance for account
     * Emit mintRewardToken event on success
     *
     * @param account account to mint rewardToken for
     * @param amount amount of depositToken to mint
     * @param finOp financial opportunity address
     */
    function mintRewardToken(
        address account, 
        uint256 amount, 
        address finOp
    ) internal validFinOp(finOp) {
        // require suffiient balance 
        require(balanceOf(account) >= amount, "insufficient balance");

        // approve finOp can spend Token
        approve(finOp, amount);

        // deposit into finOp
        uint256 rewardToken = _getFinOp(finOp).deposit(account, amount);

        // increase finOp rewardToken supply
        finOpSupply[finOp].add(rewardToken);

        // increase account rewardToken balance
        _addRewardBalance(account, amount, finOp);

        // emit mint event
        emit MintRewardToken(account, amount, finOp);
    }

    /**
     * @dev redeem rewardToken balance for depositToken
     *
     * For valid finOp, deposit Token into finOp
     * Update finOpSupply & finOpBalance for account
     * Emit mintRewardToken event on success
     *
     * @param account account to redeem rewardToken for
     * @param amount depositToken amount to redeem
     * @param finOp financial opportunitu address
     */
    function redeemRewardToken(
        address account,
        uint256 amount,
        address finOp
    ) internal validFinOp(finOp) {
        // require sufficient balance
        require(rewardTokenBalance(account, finOp) >= amount, "insufficient balance");

        // withdraw from finOp
        uint256 depositToken = _getFinOp(finOp).redeem(account, amount);

        // increase finOp rewardToken supply
        finOpSupply[finOp].sub(amount);

        // increase account rewardToken balance
        _subRewardBalance(account, amount, finOp);

        // emit mint event
        emit RedeemRewardToken(account, depositToken, finOp);
    }

    /**
     * @dev burn rewardToken without redeeming
     *
     * Burn rewardToken for finOp
     *
     * @param account account to burn rewardToken for
     * @param amount depositToken amount to burn
     * @param finOp financial opportunity address
     */
    function burnRewardToken(
        address account,
        uint256 amount,
        address finOp
    )
        internal
        validFinOp(finOp)
    {
        // burn call must come from sender
        require(msg.sender == account);

        // sender must have rewardToken amount to burn
        require(rewardTokenBalance(account, finOp) >= amount);

        // subtract reward balance from
        _subRewardBalance(account, amount, finOp);

        // reduce total supply
        finOpSupply[finOp].sub(amount);

        // burn event
        emit BurnRewardToken(account, amount, finOp);
    }

    /**
     * @dev Use reserve to swap depositToken for rewardToken
     * 
     * @param account account to give rewardToken to
     * @param amount depositToken amount to exchange for rewardToken
     * @param finOp financial opportunity
     */
    function swapDepositToken(
        address account, 
        uint256 amount,
        address finOp
    ) internal validFinOp(finOp) {
        // require account has sufficient balance
        require(balanceOf(account) >= amount,
            "insufficient balance");

        // calculate rewardToken value for depositToken amount
        uint256 rewardAmount = _toRewardToken(amount, finOp);

        // require reserve
        require(rewardTokenBalance(RESERVE, finOp) >= rewardAmount,
            "not enough rewardToken in reserve");

        // sub from account and add to reserve for depositToken
        _subBalance(account, amount);
        _addBalance(RESERVE, amount);

        // sub from reserve and add to account for rewardToken
        _subRewardBalance(RESERVE, rewardAmount, finOp);
        _addRewardBalance(account, rewardAmount, finOp);

        // emit event
        emit SwapDepositToken(account, amount, finOp);
    }

    /**
     * @dev Use reserve to swap rewardToken for Token
     * 
     * @param account account to give Token to
     * @param amount amount of depositToken to exchange for rewardToken
     * @param finOp financial opportunity
     */
    function swapRewardToken(
        address account,
        uint256 amount,
        address finOp
    ) internal validFinOp(finOp) {
        // require sufficient balance
        require (rewardTokenBalance(account, finOp) >= amount,
            "insufficient rewardToken balance");

        // get deposit value for reward token amount
        uint256 depositAmount = _toRewardToken(amount, finOp);

        // ensure reserve has enough balance
        require(balanceOf(RESERVE) >= depositAmount, "not enough depositToken in reserve");

        // sub account and add reserve for rewardToken
        _subRewardBalance(account, amount, finOp);
        _addRewardBalance(RESERVE, amount, finOp);

        // add account and add reserve for depositToken
        _subBalance(RESERVE, depositAmount);
        _addBalance(account, depositAmount);

        // emit event
        emit SwapRewardToken(account, amount, finOp);
    }

    /**
     * @dev add rewardToken balance to account
     *
     * @param account account to add to
     * @param amount rewardToken amount to add
     * @param finOp financial opportunity to add reward tokens to
     */
    function _addRewardBalance(address account, uint256 amount, address finOp) internal {
        finOpBalances[finOp][account] = finOpBalances[finOp][account].add(amount);
    }

    /**
     * @dev subtract rewardToken balance from account
     *
     * @param account account to subtract from
     * @param amount rewardToken ammount to subtract
     * @param finOp financial opportunity
     */
    function _subRewardBalance(address account, uint256 amount, address finOp) internal {
        finOpBalances[finOp][account] = finOpBalances[finOp][account].sub(amount);
    }

    /**
     * @dev Utility to convert depositToken value to rewardToken value
     *
     * @param amount depositToken amount to convert to rewardToken
     * @param finOp financial opportunity address
     */
    function _toRewardToken(uint256 amount, address finOp) internal view returns (uint256) {
        uint256 ratio = _getFinOp(finOp).tokenValue();
        return amount.mul(10 ** 18).div(ratio);
    }

    /**
     * @dev Utility to convert rewardToken value to depositToken value
     *
     * @param amount rewardToken amount to convert to depositToken
     * @param finOp financial opportunity address
     */
     function _toDepositToken(uint amount, address finOp) internal view returns (uint256) {
        uint256 ratio = _getFinOp(finOp).tokenValue();
        return ratio.mul(amount).div(10 ** 18);
    }

    /**
     * @dev utility to get FinancialOpportunity for address
     *
     * @param finOp financial opportunity to get
     */
    function _getFinOp(address finOp) internal view returns (FinancialOpportunity) {
        return FinancialOpportunity(finOp);
    }
}