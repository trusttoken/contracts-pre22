pragma solidity ^0.4.23;
import "./TimeLockedController.sol";

contract MultiSigOwner {
    mapping (address => bool) public Owners;
    mapping(address=>bool) public voted;

    TimeLockedController public timeLockController;
    address[3] public ownerList;

    modifier onlyOwner(){
        require(Owners[msg.sender]);
        _;
    }

    struct OwnerAction {
        bytes callData;
        uint approveSigs;
        uint disappoveSigs;
    }

    event ActionInitiated();
    event ActionExecuted();
    event ActionVetoed();

    OwnerAction public ownerAction;

    constructor(address[3] _initialOwners){
        Owners[_initialOwners[0]]=true;
        Owners[_initialOwners[1]]=true;
        Owners[_initialOwners[2]]=true;
        ownerList[0] = _initialOwners[0];
        ownerList[1] = _initialOwners[1];
        ownerList[2] = _initialOwners[2];
    }

    function() external payable {
    }

    function _initOwnerAction() internal {
        require(!voted[msg.sender]);
        if (ownerAction.callData.length == 0){
            emit ActionInitiated();
            ownerAction.callData = msg.data;
        }
        require(keccak256(ownerAction.callData) == keccak256(msg.data));
        ownerAction.approveSigs += 1;
        voted[msg.sender] = true;
    }

    function _deleteOwnerActon(){
        delete ownerAction;
        delete voted[ownerList[0]];
        delete voted[ownerList[1]];
        delete voted[ownerList[2]];

    }

    function updateOwner (address _oldOwner, address _newOwner) external onlyOwner returns(bool success) {
        _initOwnerAction();
        if (ownerAction.approveSigs > 1){
            Owners[_oldOwner] = false;
            Owners[_newOwner] = true;
            for (uint8 i; i < 3; i++){
                if (ownerList[i] == _oldOwner){
                    ownerList[i] = _newOwner;
                }
            }
            emit ActionExecuted();
            _deleteOwnerActon();
            return true;
        } 
    }

    function msIssueclaimContract (address _other) public onlyOwner returns(bool success) {
        _initOwnerAction();
        if (ownerAction.approveSigs > 1){
            Claimable other = Claimable(_other);
            other.claimOwnership();
            emit ActionExecuted();
            _deleteOwnerActon();
            return true;
        } 
    }

    function msReclaimContract(address _contractAddr, address _newOwner) external onlyOwner returns(bool success) {
        _initOwnerAction();
        if (ownerAction.approveSigs > 1){
            Ownable contractInst = Ownable(_contractAddr);
            contractInst.transferOwnership(_newOwner);
            emit ActionExecuted();
            _deleteOwnerActon();
            return true;
        }
    }

    function msReclaimEther(address _to) external onlyOwner returns(bool success)  {
        _initOwnerAction();
        if (ownerAction.approveSigs > 1){
            _to.transfer(address(this).balance);
            emit ActionExecuted();
            _deleteOwnerActon();
            return true;
        }
    }

    function msReclaimToken(ERC20 _token, address _to) external onlyOwner returns(bool success)  {
        _initOwnerAction();
        if (ownerAction.approveSigs > 1){
            uint256 balance = _token.balanceOf(this);
            _token.transfer(_to, balance);
            emit ActionExecuted();
            _deleteOwnerActon();
            return true;
        }
    }

    
    function msSetTimeLockController (address _newController) public onlyOwner returns(bool success)  {
        _initOwnerAction();
        if (ownerAction.approveSigs > 1){
            timeLockController = TimeLockedController(_newController);
            emit ActionExecuted();
            _deleteOwnerActon();
            return true;
        }    
    }

    function veto() public onlyOwner returns (bool success){
        require(!voted[msg.sender]);
        if (ownerAction.disappoveSigs >= 1){
            _deleteOwnerActon();
            return true;
        } else {
            ownerAction.disappoveSigs += 1;
            voted[msg.sender] = true;
            return true;
        }
    }

    function _signOrExecute() internal returns (bool success){
        _initOwnerAction();
        if (ownerAction.approveSigs > 1){
            require(address(timeLockController).call(msg.data));
            emit ActionExecuted();
            _deleteOwnerActon();
        }
    }

    function reclaimEther() external onlyOwner {
        _signOrExecute(); 
    }

    // function renounceOwnership() external onlyOwner{
    //     _signOrExecute(); 
    // }

    function transferOwnership(address newOwner) external onlyOwner {
        _signOrExecute(); 
    }

    function addMintCheckTime(uint8 _hour, uint8 _minute) external onlyOwner {
        _signOrExecute(); 
    }

    function removeMintCheckTime(uint _index) external onlyOwner {
        _signOrExecute();
     }

    function setSmallMintThreshold(uint256 _threshold) external onlyOwner {
        _signOrExecute();
     }

    function setMinimalApprovals(uint8 _smallMintApproval, uint8 _largeMintApproval) external onlyOwner {
        _signOrExecute();
     }

    function setMintLimit(uint256 _limit) external onlyOwner {
        _signOrExecute();
     }

    function resetMintedToday() external onlyOwner {
        _signOrExecute();
     }

    function requestMint(address _to, uint256 _value) external onlyOwner {
        _signOrExecute();
     }

    function finalizeMint(uint256 _index) external onlyOwner {
        _signOrExecute();
     }
    
    function approveMint(uint256 _index) external onlyOwner {
        _signOrExecute();
     }

    function revokeMint(uint256 _index) external onlyOwner {
        _signOrExecute();
     }

    function transferMintKey(address _newMintKey) external onlyOwner {
        _signOrExecute();
     }

    function invalidateAllPendingMints() external onlyOwner {
        _signOrExecute();
     } 

    function pauseMints() external onlyOwner {
        _signOrExecute();
     } 

    function unPauseMints() external onlyOwner {
        _signOrExecute();
     } 

    function pauseMint(uint _opIndex) external onlyOwner {
        _signOrExecute();
     } 

    function unpauseMint(uint _opIndex) external onlyOwner {
        _signOrExecute(); 
    }

    function addHoliday(uint _year, uint _month, uint _day) external onlyOwner {
        _signOrExecute(); 
    }

    function removeHoliday(uint _year, uint _month, uint _day) external onlyOwner {
        _signOrExecute(); 
    }

    function setDateTime(address _newContract) external onlyOwner {
        _signOrExecute(); 
    }

    function setDelegatedFrom(address _source) external onlyOwner {
        _signOrExecute(); 
    }

    function setTrueUSD(TrueUSD _newContract) external onlyOwner {
        _signOrExecute(); 
    }

    function changeTokenName(string _name, string _symbol) external onlyOwner {
        _signOrExecute(); 
    }

    function setTusdRegistry(Registry _registry) external onlyOwner {
        _signOrExecute(); 
    }

    function issueClaimOwnership(address _other) external onlyOwner {
        _signOrExecute(); 
    }

    function delegateToNewContract(DelegateBurnable _delegate,
                                   Ownable _balanceSheet,
                                   Ownable _alowanceSheet) external {
        _signOrExecute(); 
    }

    function transferChild(Ownable _child, address _newOwner) external onlyOwner {
        _signOrExecute(); 
    }

    function requestReclaimContract(Ownable _other) external onlyOwner {
        _signOrExecute(); 
    }

    function requestReclaimEther() external onlyOwner {
        _signOrExecute(); 
    }

    function requestReclaimToken(ERC20 _token) external onlyOwner {
        _signOrExecute(); 
    } 


    function setBurnBounds(uint256 _min, uint256 _max) external onlyOwner {
        _signOrExecute(); 
    }

    function changeStakingFees(uint256 _transferFeeNumerator,
                               uint256 _transferFeeDenominator,
                               uint256 _mintFeeNumerator,
                               uint256 _mintFeeDenominator,
                               uint256 _mintFeeFlat,
                               uint256 _burnFeeNumerator,
                               uint256 _burnFeeDenominator,
                               uint256 _burnFeeFlat) external onlyOwner {
        _signOrExecute(); 
    }

    function changeStaker(address _newStaker) external onlyOwner {
        _signOrExecute(); 
    }

} 