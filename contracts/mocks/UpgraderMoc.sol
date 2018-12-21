pragma solidity ^0.4.23;
contract OldTrueUSD {
    function delegateToNewContract(address _newContract) public;
    function claimOwnership() public;
    function balances() public returns(address);
    function allowances() public returns(address);
    function totalSupply() public returns(uint);
}
contract NewTrueUSD {
    function setTotalSupply(uint _totalSupply) public;
    function transferOwnership(address _newOwner) public;
    function claimOwnership() public;
}

contract TokenController {
    function claimOwnership() external;
    function transferChild(address _child, address _newOwner) external;
    function requestReclaimContract(address _child) external;
    function issueClaimOwnership(address _child) external;
    function setTrueUSD(address _newTusd) external;
    function setTusdRegistry(address _Registry) external;
    function claimStorageForProxy(address _delegate,
        address _balanceSheet,
        address _alowanceSheet) external;
    function setGlobalPause(address _globalPause) external;
    function transferOwnership(address _newOwner) external;
}

/**
 */
contract UpgradeHelper {
    OldTrueUSD public oldTrueUSD = OldTrueUSD(address(0));
    NewTrueUSD public  newTrueUSD = NewTrueUSD(address(0));
    TokenController public tokenController = TokenController(address(0));
    address public constant registry = address(1);
    address public constant globalPause = address(2);

    constructor(address _oldTrueUSD, address _newTrueUSD, address _tokenController) {
        oldTrueUSD = OldTrueUSD(_oldTrueUSD);
        newTrueUSD = NewTrueUSD(_newTrueUSD);
        tokenController = TokenController(_tokenController);
    }
    function upgrade() public {
        // Helper contract becomes the owner of controller, and both TUSD contracts
        tokenController.claimOwnership();
        tokenController.transferChild(oldTrueUSD, address(this));
        newTrueUSD.claimOwnership();
        oldTrueUSD.claimOwnership();

        // 
        address balanceSheetAddress = oldTrueUSD.balances();
        address allowanceSheetAddress = oldTrueUSD.allowances();
        tokenController.requestReclaimContract(balanceSheetAddress);
        tokenController.requestReclaimContract(allowanceSheetAddress);
        tokenController.issueClaimOwnership(balanceSheetAddress);
        tokenController.issueClaimOwnership(allowanceSheetAddress);
        tokenController.transferChild(balanceSheetAddress, newTrueUSD);
        tokenController.transferChild(allowanceSheetAddress, newTrueUSD);
        
        newTrueUSD.setTotalSupply(oldTrueUSD.totalSupply());
        newTrueUSD.transferOwnership(tokenController);
        tokenController.issueClaimOwnership(newTrueUSD);
        tokenController.setTrueUSD(newTrueUSD);
        tokenController.setTusdRegistry(registry);
        tokenController.claimStorageForProxy(newTrueUSD, balanceSheetAddress, allowanceSheetAddress);
        tokenController.setGlobalPause(globalPause);

        oldTrueUSD.delegateToNewContract(newTrueUSD);
        tokenController.transferOwnership(address(3));
    }
}
