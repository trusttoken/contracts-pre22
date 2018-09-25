pragma solidity ^0.4.23;
import "./TimeLockedController.sol";

/*
This contract is the owner of TimeLockController. 
This contract is responsible for calling all onlyOwner functions in
TimeLockController.
This contract has a copy of all functions in TimeLockController.
Functions with name starting with 'ms' are not in TimeLockController.
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

    //The controller instance that this multisig controlls
    TimeLockedController public timeLockController;

    //list of all owners of the multisigOwner
    address[3] public ownerList;

    modifier onlyOwner() {
        require(owners[msg.sender], "must be owner");
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

    OwnerAction public ownerAction;

    //Initial Owners are set during deployment
    constructor(address[3] _initialOwners) public {
        owners[_initialOwners[0]] = true;
        owners[_initialOwners[1]] = true;
        owners[_initialOwners[2]] = true;
        ownerList[0] = _initialOwners[0];
        ownerList[1] = _initialOwners[1];
        ownerList[2] = _initialOwners[2];
    }

    function() external payable {
    }

    /**
    * @dev initialize an action if there's no in flight action
    or sign the current action if the second owner is calling the same 
    function with the same parameters (same call data)
    */
    function _initOrSignOwnerAction(string _actionName) internal {
        require(!voted[msg.sender], "already voted");
        if (ownerAction.callData.length == 0) {
            emit ActionInitiated(_actionName);
            ownerAction.callData = msg.data;
        }
        require(keccak256(ownerAction.callData) == keccak256(msg.data), "different from the current action");
        ownerAction.approveSigs += 1;
        voted[msg.sender] = true;
    }

    function _deleteOwnerActon() internal {
        delete ownerAction;
        delete voted[ownerList[0]];
        delete voted[ownerList[1]];
        delete voted[ownerList[2]];
    }

    /**
    * @dev Replace a current owner with a new owner
    */
    function msUpdateOwner (address _oldOwner, address _newOwner) external onlyOwner returns(bool success) {
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
            _deleteOwnerActon();
            return true;
        } 
    }

    /**
    * @dev Let MultisigOwner contract claim ownership of a claimable contract
    */
    function msIssueclaimContract (address _other) public onlyOwner returns(bool success) {
        _initOrSignOwnerAction("msIssueclaimContract");
        if (ownerAction.approveSigs > 1) {
            Claimable other = Claimable(_other);
            other.claimOwnership();
            emit ActionExecuted("msIssueclaimContract");
            _deleteOwnerActon();
            return true;
        } 
    }

    /**
    * @dev Transfer ownership of a contract that this contract owns to a new owner
    *@param _contractAddr The contract that this contract currently owns
    *@param _newOwner The address to which the ownership will be transferred to
    */
    function msReclaimContract(address _contractAddr, address _newOwner) external onlyOwner returns(bool success) {
        _initOrSignOwnerAction("msReclaimContract");
        if (ownerAction.approveSigs > 1) {
            Ownable contractInst = Ownable(_contractAddr);
            contractInst.transferOwnership(_newOwner);
            emit ActionExecuted("msReclaimContract");
            _deleteOwnerActon();
            return true;
        }
    }

    /**
    * @dev Transfer all eth in this contract address to another address
    *@param _to The eth will be send to this address
    */
    function msReclaimEther(address _to) external onlyOwner returns(bool success) {
        _initOrSignOwnerAction("msReclaimEther");
        if (ownerAction.approveSigs > 1) {
            _to.transfer(address(this).balance);
            emit ActionExecuted("msReclaimEther");
            _deleteOwnerActon();
            return true;
        }
    }

    /**
    * @dev Transfer all specifc tokens in this contract address to another address
    *@param _token The token address of the token
    *@param _to The tokens will be send to this address
    */
    function msReclaimToken(ERC20 _token, address _to) external onlyOwner returns(bool success) {
        _initOrSignOwnerAction("msReclaimToken");
        if (ownerAction.approveSigs > 1) {
            uint256 balance = _token.balanceOf(this);
            _token.transfer(_to, balance);
            emit ActionExecuted("msReclaimToken");
            _deleteOwnerActon();
            return true;
        }
    }

    /**
    * @dev Set the instance of TimeLockController that this contract will be calling
    */
    function msSetTimeLockController (address _newController) public onlyOwner returns(bool success) {
        _initOrSignOwnerAction("msSetTimeLockController");
        if (ownerAction.approveSigs > 1) {
            timeLockController = TimeLockedController(_newController);
            emit ActionExecuted("msSetTimeLockController");
            _deleteOwnerActon();
            return true;
        }    
    }

    /**
    * @dev Veto the current in flight action. Reverts if no current action
    */
    function veto() public onlyOwner returns (bool success) {
        require(!voted[msg.sender], "already voted");
        require(ownerAction.callData.length > 0, "no action in flight");
        if (ownerAction.disappoveSigs >= 1) {
            emit ActionVetoed(ownerAction.actionName);
            _deleteOwnerActon();
            return true;
        } else {
            ownerAction.disappoveSigs += 1;
            voted[msg.sender] = true;
            return true;
        }
    }

    /**
    * @dev Internal function used to call functions of timeLockController.
    If no in flight action, create a new one. Otherwise sign and the action
    if the msg.data matches call data matches. Reverts otherwise
    */
    function _signOrExecute(string _actionName) internal returns (bool success) {
        _initOrSignOwnerAction(_actionName);
        if (ownerAction.approveSigs > 1) {
            require(address(timeLockController).call(msg.data), "timeLockController call failed");
            emit ActionExecuted(_actionName);
            _deleteOwnerActon();
        }
    }

    /*
    ============================================
    THE FOLLOWING FUNCTIONS CALLED TO TIMELOCKCONTROLLER.
    They share the same function signatures as functions in TimeLockController.
    They will generate the correct callData so that the same function will be called
    in TimeLockController.
    */

    function reclaimEther() external onlyOwner {
        _signOrExecute("reclaimEther"); 
    }

    function transferOwnership(address newOwner) external onlyOwner {
        _signOrExecute("transferOwnership"); 
    }

    function setSmallMintThreshold(uint256 _threshold) external onlyOwner {
        _signOrExecute("setSmallMintThreshold");
    }

    function setMinimalApprovals(uint8 _smallMintApproval, uint8 _largeMintApproval) external onlyOwner {
        _signOrExecute("setMinimalApprovals");
    }

    function setMintLimit(uint256 _limit) external onlyOwner {
        _signOrExecute("setMintLimit");
    }

    function resetMintedToday() external onlyOwner {
        _signOrExecute("resetMintedToday");
    }

    function setTimeZoneDiff(uint _hours) external onlyOwner {
        _signOrExecute("setTimeZoneDiff");
    }

    function requestMint(address _to, uint256 _value) external onlyOwner {
        _signOrExecute("requestMint");
    }

    function finalizeMint(uint256 _index) external onlyOwner {
        _signOrExecute("finalizeMint");
    }
    
    function approveMint(uint256 _index) external onlyOwner {
        _signOrExecute("approveMint");
    }

    function revokeMint(uint256 _index) external onlyOwner {
        _signOrExecute("revokeMint");
    }

    function transferMintKey(address _newMintKey) external onlyOwner {
        _signOrExecute("transferMintKey");
    }

    function invalidateAllPendingMints() external onlyOwner {
        _signOrExecute("invalidateAllPendingMints");
    } 

    function pauseMints() external onlyOwner {
        _signOrExecute("pauseMints");
    } 

    function unPauseMints() external onlyOwner {
        _signOrExecute("unPauseMints");
    } 

    function pauseMint(uint _opIndex) external onlyOwner {
        _signOrExecute("pauseMint");
    } 

    function unpauseMint(uint _opIndex) external onlyOwner {
        _signOrExecute("unpauseMint"); 
    }

    function addHoliday(uint16 _year, uint8 _month, uint8 _day) external onlyOwner {
        _signOrExecute("addHoliday"); 
    }

    function removeHoliday(uint _year, uint _month, uint _day) external onlyOwner {
        _signOrExecute("removeHoliday"); 
    }

    function setDateTime(address _newContract) external onlyOwner {
        _signOrExecute("setDateTime"); 
    }

    function setDelegatedFrom(address _source) external onlyOwner {
        _signOrExecute("setDelegatedFrom"); 
    }

    function setTrueUSD(TrueUSD _newContract) external onlyOwner {
        _signOrExecute("setTrueUSD"); 
    }

    function changeTokenName(string _name, string _symbol) external onlyOwner {
        _signOrExecute("changeTokenName"); 
    }

    function setTusdRegistry(Registry _registry) external onlyOwner {
        _signOrExecute("setTusdRegistry"); 
    }

    function issueClaimOwnership(address _other) external onlyOwner {
        _signOrExecute("issueClaimOwnership"); 
    }

    function delegateToNewContract(
        DelegateBurnable _delegate,
        Ownable _balanceSheet,
        Ownable _alowanceSheet) external {
        _signOrExecute("delegateToNewContract"); 
    }

    function transferChild(Ownable _child, address _newOwner) external onlyOwner {
        _signOrExecute("transferChild"); 
    }

    function requestReclaimContract(Ownable _other) external onlyOwner {
        _signOrExecute("requestReclaimContract"); 
    }

    function requestReclaimEther() external onlyOwner {
        _signOrExecute("requestReclaimEther"); 
    }

    function requestReclaimToken(ERC20 _token) external onlyOwner {
        _signOrExecute("requestReclaimToken"); 
    } 

    function setGlobalPause(address _newGlobalPause) external onlyOwner {
        _signOrExecute("setGlobalPause"); 
    } 

    function setTrueUsdFastPause(address _newFastPause) external onlyOwner {
        _signOrExecute("setTrueUsdFastPause"); 
    }

    function pauseTrueUSD() external onlyOwner {
        _signOrExecute("pauseTrueUSD"); 
    }

    function unpauseTrueUSD() external onlyOwner {
        _signOrExecute("unpauseTrueUSD"); 
    }

    function wipeBlackListedTrueUSD(address _blacklistedAddress) external onlyOwner {
        _signOrExecute("wipeBlackListedTrueUSD");
    }

    function setBurnBounds(uint256 _min, uint256 _max) external onlyOwner {
        _signOrExecute("setBurnBounds"); 
    }

    function changeStakingFees(
        uint256 _transferFeeNumerator,
        uint256 _transferFeeDenominator,
        uint256 _mintFeeNumerator,
        uint256 _mintFeeDenominator,
        uint256 _mintFeeFlat,
        uint256 _burnFeeNumerator,
        uint256 _burnFeeDenominator,
        uint256 _burnFeeFlat) external onlyOwner {
        _signOrExecute("changeStakingFees"); 
    }

    function changeStaker(address _newStaker) external onlyOwner {
        _signOrExecute("changeStaker"); 
    }
} 