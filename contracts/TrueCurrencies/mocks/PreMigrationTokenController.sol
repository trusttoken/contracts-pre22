pragma solidity^0.5.13;

import "../Admin/TokenController.sol";

import "./PreMigrationTrueUSDMock.sol";

contract PreMigrationTokenController is TokenController {
    /** 
    *@dev calls setBalanceSheet(address) and setAllowanceSheet(address) on the _proxy contract
    @param _proxy the contract that inplments setBalanceSheet and setAllowanceSheet
    @param _balanceSheet HasOwner storage contract
    @param _allowanceSheet HasOwner storage contract
    */
    function claimStorageForProxy(
        PreMigrationTrueUSDMock _proxy,
        HasOwner _balanceSheet,
        HasOwner _allowanceSheet) external onlyOwner {

        //call to claim the storage contract with the new delegate contract
        _proxy.setBalanceSheet(address(_balanceSheet));
        _proxy.setAllowanceSheet(address(_allowanceSheet));
    }
}
