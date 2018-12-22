pragma solidity ^0.4.23;
contract OldTrueUSDMock {
    function delegateToNewContract(address _newContract) public;
    function claimOwnership() public;
    function balances() public returns(address);
    function allowances() public returns(address);
    function totalSupply() public returns(uint);
    function transferOwnership(address _newOwner) external;
}
contract NewTrueUSDMock {
    function setTotalSupply(uint _totalSupply) public;
    function transferOwnership(address _newOwner) public;
    function claimOwnership() public;
}

contract TokenControllerMock {
    function claimOwnership() external;
    function transferChild(address _child, address _newOwner) external;
    function requestReclaimContract(address _child) public;
    function issueClaimOwnership(address _child) external;
    function setTrueUSD(address _newTusd) external;
    function setTusdRegistry(address _Registry) external;
    function claimStorageForProxy(address _delegate,
        address _balanceSheet,
        address _alowanceSheet) external;
    function setGlobalPause(address _globalPause) external;
    function transferOwnership(address _newOwner) external;
    function owner() external returns(address);
}

/**
 */
contract UpgradeHelperMock {
    OldTrueUSDMock public oldTrueUSD;
    NewTrueUSDMock public  newTrueUSD;
    TokenControllerMock public tokenController;
    address public constant registry = address(1);
    address public constant globalPause = address(2);

    constructor(address _oldTrueUSD, address _newTrueUSD, address _tokenController) {
        oldTrueUSD = OldTrueUSDMock(_oldTrueUSD);
        newTrueUSD = NewTrueUSDMock(_newTrueUSD);
        tokenController = TokenControllerMock(_tokenController);
    }
    function upgrade() public {
        // TokenController should have end owner as it's pending owner at the end
        address endOwner = tokenController.owner();

        // Helper contract becomes the owner of controller, and both TUSD contracts
        tokenController.claimOwnership();
        newTrueUSD.claimOwnership();

        // Initialize TrueUSD totalSupply
        newTrueUSD.setTotalSupply(oldTrueUSD.totalSupply());

        // Claim storage contract from oldTrueUSD
        address balanceSheetAddress = oldTrueUSD.balances();
        address allowanceSheetAddress = oldTrueUSD.allowances();
        tokenController.requestReclaimContract(balanceSheetAddress);
        tokenController.requestReclaimContract(allowanceSheetAddress);

        // Transfer storage contract to controller then transfer it to NewTrueUSD
        tokenController.issueClaimOwnership(balanceSheetAddress);
        tokenController.issueClaimOwnership(allowanceSheetAddress);
        tokenController.transferChild(balanceSheetAddress, newTrueUSD);
        tokenController.transferChild(allowanceSheetAddress, newTrueUSD);
        
        newTrueUSD.transferOwnership(tokenController);
        tokenController.issueClaimOwnership(newTrueUSD);
        tokenController.setTrueUSD(newTrueUSD);
        tokenController.claimStorageForProxy(newTrueUSD, balanceSheetAddress, allowanceSheetAddress);

        // Configure TrueUSD
        tokenController.setTusdRegistry(registry);
        tokenController.setGlobalPause(globalPause);

        // Point oldTrueUSD delegation to NewTrueUSD
        tokenController.transferChild(oldTrueUSD, address(this));
        oldTrueUSD.claimOwnership();
        oldTrueUSD.delegateToNewContract(newTrueUSD);
        
        // Controller owns both old and new TrueUSD
        oldTrueUSD.transferOwnership(tokenController);
        tokenController.issueClaimOwnership(oldTrueUSD);
        tokenController.transferOwnership(endOwner);
    }
}
