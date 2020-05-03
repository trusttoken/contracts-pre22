import { FinancialOpportunity } from "../TrueReward/FinancialOpportunity.sol";
import { CompliantDepositTokenWithHook } from "./CompliantDepositTokenWithHook.sol";

/**
 * @title RewardToken
 * @dev Non-transferrable token meant to represent 
 * RewardTokens are TrueCurrencies owed by a financial opportunity
 *
 * -- Overview --
 * RewardTokens are redeemable for an underlying Token.
 * RewardTokens are non-transferrable for compliance reasons
 * The caller of depositor is responsible for exchanging their
 * tokens, rather just keep accounting of user rewardToken balances
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
 */
contract RewardToken is CompliantDepositTokenWithHook {

    /* variables in proxy storage
    mapping(address => FinancialOpportunity) finOps;
    mapping(address => mapping(address => uint256)) finOpBalances;
    mapping(address => uint256) finOpSupply;
    */

    event MintRewardToken(address account, uint256 amount, address finOp);
    event RedeemRewardToken(address account, uint256 amount, address finOp);
    event BurnRewardToken(address account, uint256 amount, address finOp);

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
     * @param finOp financial opportunity
     */
    function rewardTokenSupply(
        address finOp
    ) public view validFinOp(finOp) returns (uint256) {
        return finOpSupply[finOp];
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
    ) public view validFinOp(finOp) returns (uint256) {
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
        uint256 rewardAmount = _getFinOp(finOp).deposit(account, amount);

        // increase finOp rewardToken supply
        finOpSupply[finOp].add(rewardAmount);

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
        uint256 tokenAmount = _getFinOp(finOp).redeem(account, amount);

        // increase finOp rewardToken supply
        finOpSupply[finOp].sub(amount);

        // increase account rewardToken balance
        _subRewardBalance(account, amount, finOp);

        // emit mint event
        emit RedeemRewardToken(account, tokenAmount, finOp);
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
     function _toToken(uint amount, address finOp) internal view returns (uint256) {
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