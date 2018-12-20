pragma solidity ^0.4.23;
import 
contract OldTrueUSD {
    
}
contract NewTrueUSD {
    
}

contract TokenController {

}

/**
 */
contract UpgradeHelper {
    OldTrueUSD public constant oldTrueUSD = OldTrueUSD(address(0));
    NewTrueUSD public constant newTrueUSD = NewTrueUSD(address(0));
    TokenController public constant tokenController = TokenController(address(0));
    address public constant registry = address(0);

    function upgrade(){
        tokenController.claimOwnership();
        tokenController.transferChild(oldTrueUSD, address(this));
        newTrueUSD.claimOwnership();
        oldTrueUSD.claimOwnership();
        tokenController.requestReclaimContract(oldTrueUSD.balances);
        tokenController.requestReclaimContract(oldTrueUSD.allowances);
        tokenController.issueClaimOwnership(oldTrueUSD.balances);
        tokenController.issueClaimOwnership(oldTrueUSD.allowances);
        tokenController.transferChild(oldTrueUSD.balances, newTrueUSD);
        tokenController.transferChild(oldTrueUSD.allowances, newTrueUSD);
        claimStorageForProxy.

        newTrueUSD.transferOwnership(tokenController);
        tokenController.issueClaimOwnership(newTrueUSD);
        tokenController.setTrueUSD(newTrueUSD);
        tokenController.setTusdRegistry(registry);
        
    }
}
