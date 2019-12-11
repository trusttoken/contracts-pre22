pragma solidity ^0.5.13;

import "./TokenController.sol";
import "../Proxy/OwnedUpgradeabilityProxy.sol";

/*
This contract is the owner of TokenController. 
This contract is responsible for calling all onlyOwner functions in
TokenController.
This contract has a copy of all functions in TokenController.
Functions with name starting with 'ms' are not in TokenController.
They are for admin purposes (eg. transfer eth out of MultiSigOwner)
MultiSigOwner contract has three owners
The first time a function is called, an action is created.
The action is in pending state until another owner approve the action.
Once another owner approves, the action will be executed immediately.
There can only be one pending/in flight action at a time. 
To approve an action the owner needs to call the same function with the
same parameter. If the function or parameter doesn't match the current in
flight action, it is reverted. 
Each owner can only approve/veto the current action once.
Vetoing an in flight also requires 2/3 owners to veto.
*/
contract MultiSigOwner {

    mapping (address => bool) public owners;

    //mapping that keeps track of which owner had already voted in the current action
    mapping(address=>bool) public voted;

    //The controller instance that this multisig controls
    TokenController public tokenController;

    //list of all owners of the multisigOwner
    address[3] public ownerList;


    bool public initialized;

    //current owner action
    OwnerAction public ownerAction;

    modifier onlyOwner() {
        require(owners[msg.sender], "only Owner");
        _;
    }

    struct OwnerAction {
        bytes callData;
        string actionName;
        uint8 approveSigs;
        uint8 disappoveSigs;
    }

    event ActionInitiated(string actionName);
    event ActionExecuted(string actionName);
    event ActionVetoed(string actionName);


    //Initial Owners are set during deployment
    function msInitialize(address[3] calldata _initialOwners) external {
        require(!initialized);
        require(_initialOwners[0] != address(0) &&
        _initialOwners[1] != address(0) &&
        _initialOwners[2] != address(0));
        owners[_initialOwners[0]] = true;
        owners[_initialOwners[1]] = true;
        owners[_initialOwners[2]] = true;
        ownerList[0] = _initialOwners[0];
        ownerList[1] = _initialOwners[1];
        ownerList[2] = _initialOwners[2];
        initialized = true;
    }

    function() external payable {
    }

    /**
    * @dev initialize an action if there's no in flight action
    or sign the current action if the second owner is calling the same 
    function with the same parameters (same call data)
    */
    function _initOrSignOwnerAction(string memory _actionName) internal {
        require(!voted[msg.sender], "already voted");
        if (ownerAction.callData.length == 0) {
            emit ActionInitiated(_actionName);
            ownerAction.callData = msg.data;
        }
        require(keccak256(ownerAction.callData) == keccak256(msg.data), "different from the current action");
        ownerAction.approveSigs += 1;
        voted[msg.sender] = true;
    }

    function _deleteOwnerAction() internal {
        delete ownerAction;
        delete voted[ownerList[0]];
        delete voted[ownerList[1]];
        delete voted[ownerList[2]];
    }

    function msUpgradeImplementation(address _newImplementation) external onlyOwner {
        _initOrSignOwnerAction("msUpgradeImplementation");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(this)).upgradeTo(_newImplementation);
            emit ActionExecuted("msUpgradeImplementation");
            _deleteOwnerAction();
        } 
    }

    function msTransferProxyOwnership(address _newProxyOwner) external onlyOwner {
        _initOrSignOwnerAction("msTransferProxyOwnership");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(this)).transferProxyOwnership(_newProxyOwner);
            emit ActionExecuted("msTransferProxyOwnership");
            _deleteOwnerAction();
        } 
    }

    function msClaimProxyOwnership() external onlyOwner {
        _initOrSignOwnerAction("msClaimProxyOwnership");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(this)).claimProxyOwnership();
            emit ActionExecuted("msClaimProxyOwnership");
            _deleteOwnerAction();
        } 
    }

    /**
    * @dev Replace a current owner with a new owner
    */
    function msUpdateOwner (address _oldOwner, address _newOwner) external onlyOwner {
        require(owners[_oldOwner] && !owners[_newOwner]);
        _initOrSignOwnerAction("updateOwner");
        if (ownerAction.approveSigs > 1) {
            owners[_oldOwner] = false;
            owners[_newOwner] = true;
            for (uint8 i; i < 3; i++) {
                if (ownerList[i] == _oldOwner) {
                    ownerList[i] = _newOwner;
                }
            }
            emit ActionExecuted("updateOwner");
            _deleteOwnerAction();
        } 
    }


    /**
    * @dev Let MultisigOwner contract claim ownership of a claimable contract
    */
    function msIssueClaimContract(address _other) external onlyOwner {
        _initOrSignOwnerAction("msIssueClaimContract");
        if (ownerAction.approveSigs > 1) {
            Claimable other = Claimable(_other);
            other.claimOwnership();
            emit ActionExecuted("msIssueClaimContract");
            _deleteOwnerAction();
        } 
    }

    /**
    * @dev Transfer ownership of a contract that this contract owns to a new owner
    *@param _contractAddr The contract that this contract currently owns
    *@param _newOwner The address to which the ownership will be transferred to
    */
    function msReclaimContract(address _contractAddr, address _newOwner) external onlyOwner {
        _initOrSignOwnerAction("msReclaimContract");
        if (ownerAction.approveSigs > 1) {
            Ownable contractInst = Ownable(_contractAddr);
            contractInst.transferOwnership(_newOwner);
            emit ActionExecuted("msReclaimContract");
            _deleteOwnerAction();
        }
    }

    /**
    * @dev Transfer all eth in this contract address to another address
    *@param _to The eth will be send to this address
    */
    function msReclaimEther(address payable _to) external onlyOwner {
        _initOrSignOwnerAction("msReclaimEther");
        if (ownerAction.approveSigs > 1) {
            _to.transfer(address(this).balance);
            emit ActionExecuted("msReclaimEther");
            _deleteOwnerAction();
        }
    }

    /**
    * @dev Transfer all specifc tokens in this contract address to another address
    *@param _token The token address of the token
    *@param _to The tokens will be send to this address
    */
    function msReclaimToken(IERC20 _token, address _to) external onlyOwner {
        _initOrSignOwnerAction("msReclaimToken");
        if (ownerAction.approveSigs > 1) {
            uint256 balance = _token.balanceOf(address(this));
            _token.transfer(_to, balance);
            emit ActionExecuted("msReclaimToken");
            _deleteOwnerAction();
        }
    }

    /**
    * @dev Set the instance of TokenController that this contract will be calling
    */
    function msSetTokenController (address _newController) public onlyOwner {
        _initOrSignOwnerAction("msSetTokenController");
        if (ownerAction.approveSigs > 1) {
            tokenController = TokenController(_newController);
            emit ActionExecuted("msSetTokenController");
            _deleteOwnerAction();
        }    
    }

    function msTransferControllerProxyOwnership(address _newOwner) external onlyOwner {
        _initOrSignOwnerAction("msTransferControllerProxyOwnership");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(uint160(address(tokenController)))).transferProxyOwnership(_newOwner);
            emit ActionExecuted("msTransferControllerProxyOwnership");
            _deleteOwnerAction();
        }
    }

    function msClaimControllerProxyOwnership() external onlyOwner {
        _initOrSignOwnerAction("msClaimControllerProxyOwnership");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(uint160(address(tokenController)))).claimProxyOwnership();
            emit ActionExecuted("msClaimControllerProxyOwnership");
            _deleteOwnerAction();
        }
    }

    function msUpgradeControllerProxyImplTo(address _implementation) external onlyOwner {
        _initOrSignOwnerAction("msUpgradeControllerProxyImplTo");
        if (ownerAction.approveSigs > 1) {
            OwnedUpgradeabilityProxy(address(uint160(address(tokenController)))).upgradeTo(_implementation);
            emit ActionExecuted("msUpgradeControllerProxyImplTo");
            _deleteOwnerAction();
        }
    }


    /**
    * @dev Veto the current in flight action. Reverts if no current action
    */
    function msVeto() public onlyOwner {
        require(!voted[msg.sender], "already voted");
        require(ownerAction.callData.length > 0, "no action in flight");
        if (ownerAction.disappoveSigs >= 1) {
            emit ActionVetoed(ownerAction.actionName);
            _deleteOwnerAction();
        } else {
            ownerAction.disappoveSigs += 1;
            voted[msg.sender] = true;
        }
    }

    /**
    * @dev Internal function used to call functions of tokenController.
    If no in flight action, create a new one. Otherwise sign and the action
    if the msg.data matches call data matches. Reverts otherwise
    */
    function _signOrExecute(string memory _actionName) internal {
        _initOrSignOwnerAction(_actionName);
        if (ownerAction.approveSigs > 1) {
            (bool success,) = address(tokenController).call(msg.data);
            require(success, "tokenController call failed");
            emit ActionExecuted(_actionName);
            _deleteOwnerAction();
        }
    }

    /*
    ============================================
    THE FOLLOWING FUNCTIONS CALLED TO TokenController.
    They share the same function signatures as functions in TokenController.
    They will generate the correct callData so that the same function will be called
    in TokenController.
    */

    function initialize() external onlyOwner {
        _signOrExecute("initialize"); 
    }

    function transferTusdProxyOwnership(address /*_newOwner*/) external onlyOwner {
        _signOrExecute("transferTusdProxyOwnership"); 
    }
    
    function claimTusdProxyOwnership() external onlyOwner {
        _signOrExecute("claimTusdProxyOwnership"); 
    }

    function upgradeTusdProxyImplTo(address /*_implementation*/) external onlyOwner {
        _signOrExecute("upgradeTusdProxyImplTo"); 
    }

    function transferOwnership(address /*newOwner*/) external onlyOwner {
        _signOrExecute("transferOwnership"); 
    }

    function claimOwnership() external onlyOwner {
        _signOrExecute("claimOwnership"); 
    }

    function setMintThresholds(uint256 /*_instant*/, uint256 /*_ratified*/, uint256 /*_multiSig*/) external onlyOwner {
        _signOrExecute("setMintThresholds");
    }

    function setMintLimits(uint256 /*_instant*/, uint256 /*_ratified*/, uint256 /*_multiSig*/) external onlyOwner {
        _signOrExecute("setMintLimit");
    }

    function refillInstantMintPool() external onlyOwner {
        _signOrExecute("refillInstantMintPool");
    }

    function refillRatifiedMintPool() external onlyOwner {
        _signOrExecute("refillRatifiedMintPool");
    }

    function refillMultiSigMintPool() external onlyOwner {
        _signOrExecute("refillMultiSigMintPool");
    }

    function requestMint(address /*_to*/, uint256 /*_value*/) external onlyOwner {
        _signOrExecute("requestMint");
    }

    function instantMint(address /*_to*/, uint256 /*_value*/) external onlyOwner {
        _signOrExecute("instantMint");
    }

    function ratifyMint(uint256 /*_index*/, address /*_to*/, uint256 /*_value*/) external onlyOwner {
        _signOrExecute("ratifyMint");
    }
    
    function revokeMint(uint256 /*_index*/) external onlyOwner {
        _signOrExecute("revokeMint");
    }

    function transferMintKey(address /*_newMintKey*/) external onlyOwner {
        _signOrExecute("transferMintKey");
    }

    function invalidateAllPendingMints() external onlyOwner {
        _signOrExecute("invalidateAllPendingMints");
    } 

    function pauseMints() external onlyOwner {
        _signOrExecute("pauseMints");
    } 

    function unpauseMints() external onlyOwner {
        _signOrExecute("unpauseMints");
    } 

    function pauseMint(uint /*_opIndex*/) external onlyOwner {
        _signOrExecute("pauseMint");
    } 

    function unpauseMint(uint /*_opIndex*/) external onlyOwner {
        _signOrExecute("unpauseMint"); 
    }

    function setToken(CompliantDepositTokenWithHook /*_newContract*/) external onlyOwner {
        _signOrExecute("setToken"); 
    }

    function setRegistry(Registry /*_registry*/) external onlyOwner {
        _signOrExecute("setRegistry"); 
    }

    function setTokenRegistry(Registry /*_registry*/) external onlyOwner {
        _signOrExecute("setTokenRegistry"); 
    }

    function issueClaimOwnership(address /*_other*/) external onlyOwner {
        _signOrExecute("issueClaimOwnership"); 
    }

    function transferChild(Ownable /*_child*/, address /*_newOwner*/) external onlyOwner {
        _signOrExecute("transferChild"); 
    }

    function requestReclaimContract(Ownable /*_other*/) external onlyOwner {
        _signOrExecute("requestReclaimContract"); 
    }

    function requestReclaimEther() external onlyOwner {
        _signOrExecute("requestReclaimEther"); 
    }

    function requestReclaimToken(IERC20 /*_token*/) external onlyOwner {
        _signOrExecute("requestReclaimToken"); 
    } 

    function setFastPause(address /*_newFastPause*/) external onlyOwner {
        _signOrExecute("setFastPause"); 
    }

    function pauseToken() external onlyOwner {
        _signOrExecute("pauseToken"); 
    }

    function wipeBlackListedTrueUSD(address /*_blacklistedAddress*/) external onlyOwner {
        _signOrExecute("wipeBlackListedTrueUSD");
    }

    function setBurnBounds(uint256 /*_min*/, uint256 /*_max*/) external onlyOwner {
        _signOrExecute("setBurnBounds"); 
    }

    function reclaimEther(address /*_to*/) external onlyOwner {
        _signOrExecute("reclaimEther"); 
    }

    function reclaimToken(IERC20 /*_token*/, address /*_to*/) external onlyOwner {
        _signOrExecute("reclaimToken"); 
    }
} 
