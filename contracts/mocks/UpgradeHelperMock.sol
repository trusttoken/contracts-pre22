pragma solidity ^0.4.23;
import "../utilities/UpgradeHelper.sol";

contract UpgradeHelperMock {
    OldTrueUSDInterface public oldTrueUSD;
    NewTrueUSDInterface public  newTrueUSD;
    TokenControllerInterface public tokenController;
    address public constant registry = address(0x0000000000013949f288172bd7e36837bddc7211);

    constructor(address _oldTrueUSD, address _newTrueUSD, address _tokenController) {
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
