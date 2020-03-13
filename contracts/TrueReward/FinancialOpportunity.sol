pragma solidity ^0.5.13;

/** Interface for Financial Opportunities. **/
interface FinancialOpportunity {
    /**
     * @dev deposits TrueUSD into finOP using transferFrom
     * @param _from account to transferFrom
     * @param _amount amount in TUSD to deposit to finOp
     * @return yTUSD minted from this deposit
     */
    function deposit(address _from, uint _amount) external returns(uint);
     /**
     * @dev Withdraw from finOp to _to account
     * @param _to account withdarw TUSD to
     * @param _amount amount in TUSD to withdraw from finOp
     * @return yTUSD amount deducted
     */
    function withdrawTo(address _to, uint _amount) external returns(uint);
    // withdrawll actually withdraw all tokens in finOp
    function withdrawAll(address _to) external returns(uint);
    function perTokenValue() external view returns(uint);
}