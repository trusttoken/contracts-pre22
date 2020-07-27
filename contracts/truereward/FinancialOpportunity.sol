// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

/**
 * @title FinancialOpportunity
 * @dev Interface for third parties to implement financial opportunities
 *
 * -- Overview --
 * The goal of this contract is to allow anyone to create an opportunity
 * to earn interest on TrueCurrency. deposit() "mints" yTrueCurrency which is redeemable
 * for some amount of TrueCurrency. TrueUSD wraps this contract with TrustToken
 * Assurance, which provides protection from bugs and system design flaws
 * TrueCurrency is a compliant stable coin, therefore we do not allow transfers of
 * yTrueCurrency, thus there are no transfer functions
 *
 * -- tokenValue() --
 * This function returns the value in TrueCurrency of 1 yTrueCurrency
 * This value should never decrease
 *
 * -- TrueCurrency vs yTrueCurrency --
 * yTrueCurrency represents a fixed value which is redeemable for some amount of TrueCurrency
 * Think of yTrueCurrency like cTrueCurrency, where cTokens are minted and increase in value versus
 * the underlying asset as interest is accrued
 *
 * -- totalSupply() --
 * This function returns the total supply of yTrueCurrency issued by this contract
 * It is important to track this value accurately and add/deduct the correct
 * amount on deposit/redemption
 *
 * -- Assumptions --
 * - tokenValue can never decrease
 * - total TrueCurrency owed to depositors = tokenValue() * totalSupply()
 */
interface FinancialOpportunity {
    /**
     * @dev Returns total supply of yTrueCurrency in this contract
     *
     * @return total supply of yTrueCurrency in this contract
     **/
    function totalSupply() external view returns (uint256);

    /**
     * @dev Exchange rate between TrueCurrency and yTrueCurrency
     *
     * tokenValue should never decrease
     *
     * @return TrueCurrency / yTrueCurrency price ratio
     */
    function tokenValue() external view returns (uint256);

    /**
     * @dev deposits TrueUSD and returns yTrueCurrency minted
     *
     * We can think of deposit as a minting function which
     * will increase totalSupply of yTrueCurrency based on the deposit
     *
     * @param from account to transferFrom
     * @param amount amount in TrueCurrency to deposit
     * @return yTrueCurrency minted from this deposit
     */
    function deposit(address from, uint256 amount) external returns (uint256);

    /**
     * @dev Redeem yTrueCurrency for TrueCurrency and withdraw to account
     *
     * This function should use tokenValue to calculate
     * how much TrueCurrency is owed. This function should burn yTrueCurrency
     * after redemption
     *
     * This function must return value in TrueCurrency
     *
     * @param to account to transfer TrueCurrency for
     * @param amount amount in TrueCurrency to withdraw from finOp
     * @return TrueCurrency amount returned from this transaction
     */
    function redeem(address to, uint256 amount) external returns (uint256);
}
