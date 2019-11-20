pragma solidity ^0.5.13;
import "../utilities/UpgradeHelper.sol";

contract UpgradeHelperMock {
    OldTrueUSDInterface public oldTrueUSD;
    NewTrueUSDInterface public  newTrueUSD;
    TokenControllerInterface public tokenController;
    address public constant registry = address(0x0000000000013949F288172bD7E36837bDdC7211);

    constructor(address _oldTrueUSD, address _newTrueUSD, address _tokenController) public {
        oldTrueUSD = OldTrueUSDInterface(_oldTrueUSD);
        newTrueUSD = NewTrueUSDInterface(_newTrueUSD);
        tokenController = TokenControllerInterface(_tokenController);
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
        tokenController.issueClaimOwnership(address(balanceSheetAddress));
        tokenController.issueClaimOwnership(address(allowanceSheetAddress));
        tokenController.transferChild(address(balanceSheetAddress), address(newTrueUSD));
        tokenController.transferChild(address(allowanceSheetAddress), address(newTrueUSD));
        
        newTrueUSD.transferOwnership(address(tokenController));
        tokenController.issueClaimOwnership(address(newTrueUSD));
        tokenController.setToken(address(newTrueUSD));
        tokenController.claimStorageForProxy(address(newTrueUSD), balanceSheetAddress, allowanceSheetAddress);

        // Configure TrueUSD
        tokenController.setTokenRegistry(registry);

        // Point oldTrueUSD delegation to NewTrueUSD
        tokenController.transferChild(address(oldTrueUSD), address(this));
        oldTrueUSD.claimOwnership();
        oldTrueUSD.delegateToNewContract(address(newTrueUSD));
        
        // Controller owns both old and new TrueUSD
        oldTrueUSD.transferOwnership(address(tokenController));
        tokenController.issueClaimOwnership(address(oldTrueUSD));
        tokenController.transferOwnership(endOwner);
    }
}
