pragma solidity ^0.5.13;
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
    /**
     * @dev Withdraws all TUSD from finOp
     * @param _to account withdarw TUSD to
     * @return yTUSD amount deducted
     */
    function withdrawAll(address _to) external returns(uint);

    /**
     * Exchange rate between TUSD and yTUSD  
     * @return TUSD / yTUSD price ratio
     */
    function perTokenValue() external view returns(uint);

    /** 
     * Returns full balance of opportunity
     * @return yTUSD balance of opportunity
    **/
    function getBalance() external view returns (uint);
}
