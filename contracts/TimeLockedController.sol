pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/HasNoEther.sol";
import "openzeppelin-solidity/contracts/ownership/HasNoTokens.sol";
import "openzeppelin-solidity/contracts/ownership/Claimable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./TrueUSD.sol";
import "./utilities/DateTime.sol";
import "../registry/contracts/HasRegistry.sol";



/* This contract allows us to split ownership of the TrueUSD contract (and TrueUSD's Registry)
into two addresses. One, called the "owner" address, has unfettered control of the TrueUSD contract -
it can mint new tokens, transfer ownership of the contract, etc. However to make
extra sure that TrueUSD is never compromised, this owner key will not be used in
day-to-day operations, allowing it to be stored at a heightened level of security.
Instead, the owner appoints an various "admin" address. 
There are 3 different types of admin addresses;  MintKey, MintApprover, and MintChecker. 
MintKey can request and revoke and finalize mints one at a time.
MintChecker can pause individual mints or pause all mints.
MintApprover needs to approve the mint for any mint to be finalized.
Additionally, the MintKey can  only mint new tokens by calling a pair of functions - 
`requestMint` and `finalizeMint` - with significant gaps in time between the two calls.
This allows us to watch the blockchain and if we discover the mintkey has been
compromised and there are unauthorized operations underway, we can use the owner key
to pause the mint.

Rules to when a mint can be finalized:
 A requested mint can be finalized if and only if there exists a checktime P with the following properties:
  1. The mint was requested at least 30 min before P
  2. The current time is at least  2 hrs after P

*/

contract TimeLockedController is HasRegistry, HasNoEther, HasNoTokens, Claimable {
    using SafeMath for uint256;

    struct MintOperation {
        address to;
        uint256 value;
        uint256 requestedBlock;
        uint256 timeRequested;
        uint256 numberOfApproval;
        bool paused;
        mapping(address => bool) approved; 
    }

    struct TimeOfDay {
        uint8 hour;
        uint8 minute;
    }

    mapping(bytes32 => bool) public holidays; //hash of dates to boolean

    bool public mintPaused;
    uint256 public smallMintThreshold; //threshold for a mint to be considered  a small mint
    uint8 public minSmallMintApproval; //minimal number of approvals needed for a small mint
    uint8 public minLargeMintApproval; //minimal number of approvals needed for a large mint
    uint256 public dailyMintLimit; 
    uint256 public mintedToday; //how many tokens are requested today
    uint256 public timeOfLastMint; //used to refresh dailyMintLimit
    uint256 public mintReqInValidBeforeThisBlock; //all mint request before this block are invalid
    address public mintKey;
    address public trueUsdFastPause;
    TrueUSD public trueUSD;
    DateTimeAPI public dateTime; //datetime contract to get timestamp and date
    MintOperation[] public mintOperations; //list of a mint requests
    TimeOfDay public firstMintCheckTimes = TimeOfDay(10, 0); 
    TimeOfDay public secondMintCheckTimes = TimeOfDay(16, 0); 

    uint256 public timeZoneDiff = 7 hours; //shift time zones (currently PDT). 0 means UTC

    string constant public IS_MINT_CHECKER = "isTUSDMintChecker";
    string constant public IS_MINT_APPROVER = "isTUSDMintApprover";

    modifier onlyFastPauseOrOwner() {
        require(msg.sender == trueUsdFastPause || msg.sender == owner, "must be mintKey or owner");
        _;
    }

    modifier onlyMintKeyOrOwner() {
        require(msg.sender == mintKey || msg.sender == owner, "must be mintKey or owner");
        _;
    }

    modifier onlyMintCheckerOrOwner() {
        require(registry.hasAttribute(msg.sender, IS_MINT_CHECKER) || msg.sender == owner, "must be validator or owner");
        _;
    }

    modifier onlyMintApproverOrOwner() {
        require(registry.hasAttribute(msg.sender, IS_MINT_APPROVER) || msg.sender == owner, "must be approver or owner");
        _;
    }

    //mint operations by the mintkey cannot be processed on when mints are paused
    modifier mintNotPaused() {
        if (msg.sender != owner) {
            require(!mintPaused, "minting is paused");
        }
        _;
    }

    //mint operations by the mintkey cannot be processed on weekend
    modifier notOnWeekend() {
        if (msg.sender != owner) {
            uint8 weekday = dateTime.getWeekday(now.sub(timeZoneDiff));
            require(weekday != 0, "cannot mint on weekend");
            require(weekday != 6, "cannot mint on weekend");
        }
        _;
    }

    //mint operations by the mintkey cannot be processed on defined holidays
    modifier notOnHoliday() {
        if (msg.sender != owner) {
            uint shiftedTimestamp = now.sub(timeZoneDiff);
            uint16 year = dateTime.getYear(shiftedTimestamp);
            uint8 month = dateTime.getMonth(shiftedTimestamp);
            uint8 day = dateTime.getDay(shiftedTimestamp);
            require(!holidays[keccak256(year, month, day)], "not on holiday");
        }
        _;
    }

    event RequestMint(address indexed to, address indexed mintKey, uint256 indexed value, uint256 requestedTime, uint256 opIndex);
    event FinalizeMint(address indexed to, address indexed mintKey, uint256 indexed value, uint256 opIndex);
    event TransferChild(address indexed child, address indexed newOwner);
    event RequestReclaimContract(address indexed other);
    event SetTrueUSD(TrueUSD newContract);
    event TransferMintKey(address indexed previousMintKey, address indexed newMintKey);
    event RevokeMint(uint256 opIndex);
    event AllMintsPaused(bool status);
    event MintPaused(uint opIndex, bool status);

    event MintApproved(address approver, uint opIndex);
    event MintLimitReset(address sender);
    event ApprovalThresholdChanged(uint8 smallMintApproval, uint8 largeMintApproval);
    event SmallMintThresholdChanged(uint oldThreshold, uint newThreshold);
    event DailyLimitChanged(uint oldLimit, uint newLimit);
    event HolidayModified(uint16 year, uint8 month, uint8 day, bool status);
    event DateTimeAddressSet(address newDateTimeContract);
    event TrueUsdFastPauseSet(address _newFastPause);
    event TimeZoneChanged(uint256 oldTimeZone, uint256 newTimeZone);
    /*
    ========================================
    Minting functions
    ========================================
    */
    
    /**
     * @dev define the threshold for a mint to be considered a small mint.
     small mints requires a smaller number of approvals
     * @param _threshold the threshold for a small mint
     */
    function setSmallMintThreshold(uint256 _threshold) external onlyOwner {
        emit SmallMintThresholdChanged(smallMintThreshold, _threshold);
        smallMintThreshold = _threshold;
    }

    /**
     * @dev Set the number of approvals needed to approve a small mint and a large mint
     * @param _smallMintApproval number of approvals needed for a small mint
     * @param _largeMintApproval number of approvals needed for a large mint
     */
    function setMinimalApprovals(uint8 _smallMintApproval, uint8 _largeMintApproval) external onlyOwner {
        minSmallMintApproval = _smallMintApproval;
        minLargeMintApproval = _largeMintApproval;
        emit ApprovalThresholdChanged(_smallMintApproval, _largeMintApproval);
    }

    /**
     * @dev set limit on the amount of tokens that can be requested each day 
     * @param _limit limit on the amount of tokens that can be requested each day
     */
    function setMintLimit(uint256 _limit) external onlyOwner {
        emit DailyLimitChanged(dailyMintLimit, _limit);
        dailyMintLimit = _limit;
    }
    
    /**
     * @dev reset the amount that had been requested today
     */ 
    function resetMintedToday() external onlyOwner {
        mintedToday = 0;
        emit MintLimitReset(msg.sender);
    }

    /**
     * @dev reset the amount that had been requested today
     */ 
    function setTimeZoneDiff(uint _hours) external onlyOwner{
        emit TimeZoneChanged(timeZoneDiff.div(1 hours), _hours);
        timeZoneDiff = _hours.mul(1 hours);
    }

    /**
     * @dev mintKey initiates a request to mint _value TrueUSD for account _to
     * @param _to the address to mint to
     * @param _value the amount requested
     */
    function requestMint(address _to, uint256 _value) external mintNotPaused notOnHoliday notOnWeekend onlyMintKeyOrOwner {
        uint currentTimeZoneTime = now.sub(timeZoneDiff);
        if (dateTime.getMonth(currentTimeZoneTime) == dateTime.getMonth(timeOfLastMint) &&
            dateTime.getDay(currentTimeZoneTime) == dateTime.getDay(timeOfLastMint)) {
            mintedToday = mintedToday.add(_value);
            require(mintedToday <= dailyMintLimit, "over the mint limit");
        }else {
            mintedToday = _value;
        }
        timeOfLastMint = currentTimeZoneTime;
        MintOperation memory op = MintOperation(_to, _value, block.number, currentTimeZoneTime, 0, false);
        mintOperations.push(op);
        emit RequestMint(_to, msg.sender, _value, timeOfLastMint, mintOperations.length);
    }

    /**
     * @dev compute whether or not the mint checktime conditions are met
     * @return a boolean indicating whether or not enough time has elapsed since the request
     */
    function enoughTimePassed(uint256 timeRequested) public view returns (bool) {
        uint16 year = dateTime.getYear(now.sub(timeZoneDiff));
        uint8 month = dateTime.getMonth(now.sub(timeZoneDiff));
        uint8 day = dateTime.getDay(now.sub(timeZoneDiff));

        uint16 yesterdayYear = dateTime.getYear(now.sub(1 days).sub(timeZoneDiff));
        uint8 yesterdayMonth = dateTime.getMonth(now.sub(1 days).sub(timeZoneDiff));
        uint8 yesterday = dateTime.getDay(now.sub(1 days).sub(timeZoneDiff));

        uint yesterdaySecondCheckTime = dateTime.toTimestamp(yesterdayYear,
        yesterdayMonth, yesterday, secondMintCheckTimes.hour, secondMintCheckTimes.minute);
        if (timeRequested.add(30 minutes) <= yesterdaySecondCheckTime) {
            return true;
        }
        uint firstCheckTime = dateTime.toTimestamp(year, month, day, firstMintCheckTimes.hour, firstMintCheckTimes.minute);
        if (now.sub(timeZoneDiff) >= firstCheckTime.add(2 hours)) {
            if (timeRequested.add(30 minutes) < firstCheckTime) {
                return true;
            }
        }
        uint secondCheckTime = dateTime.toTimestamp(year, month, day, secondMintCheckTimes.hour, secondMintCheckTimes.minute);
        if (now.sub(timeZoneDiff) >= secondCheckTime.add(2 hours)) {
            if (timeRequested.add(30 minutes) < secondCheckTime) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev compute if the number of approvals is enough for a given mint amount
     */
    function hasEnoughApproval(uint256 numberOfApproval, uint256 value) public view returns (bool) {
        if (value < smallMintThreshold) {
            if (numberOfApproval < minSmallMintApproval) {
                return false;
            }
        }else {
            if (numberOfApproval < minLargeMintApproval) {
                return false;
            }
        }
        return true;
    }

    /**
     * @dev compute if a mint request meets all the requirements to be finalized
     utility function for a front end
     */
    function canFinalize(uint256 _index) public view notOnHoliday notOnWeekend returns(bool) {
        MintOperation memory op = mintOperations[_index];
        require(op.requestedBlock > mintReqInValidBeforeThisBlock, "this mint is invalid");
        require(!op.paused, "this mint is paused");
        require(enoughTimePassed(op.timeRequested), "not enough time passed"); //checks that enough time has elapsed
        require(hasEnoughApproval(op.numberOfApproval, op.value), "not enough approvals");
        return true;
    }

    /**
     * @dev finalize a mint request, mint the amount requested to the specified address
     @param _index of the request (visible in the RequestMint event accompanying the original request)
     */
    function finalizeMint(uint256 _index) external mintNotPaused notOnHoliday notOnWeekend onlyMintKeyOrOwner {
        if (msg.sender == mintKey) {
            require(canFinalize(_index));
        }
        MintOperation memory op = mintOperations[_index];
        address to = op.to;
        uint256 value = op.value;
        delete mintOperations[_index];
        trueUSD.mint(to, value);
        emit FinalizeMint(to, msg.sender, value, _index);
    }

    /** 
    *@dev approve a mint request, does not mint. A request mint requires at least approvals before it can be finalized
    *@param index of the request (visible in the RequestMint event accompanying the original request)
    */
    function approveMint(uint256 _index) external onlyMintApproverOrOwner {
        require(!mintOperations[_index].approved[msg.sender], "already approved");
        mintOperations[_index].approved[msg.sender] = true;
        mintOperations[_index].numberOfApproval = mintOperations[_index].numberOfApproval.add(1);
        emit MintApproved(msg.sender, _index);
    }

    /** 
    *@dev revoke a mint request, Delete the mintOperation
    *@param index of the request (visible in the RequestMint event accompanying the original request)
    */
    function revokeMint(uint256 _index) external onlyMintKeyOrOwner {
        delete mintOperations[_index];
        emit RevokeMint(_index);
    }

    /** 
    *@dev return current time in pacific time
    */
    function returnTime() public view returns(uint256) {
        return now.sub(timeZoneDiff);
    }

    /*
    ========================================
    Key management
    ========================================
    */

    /** 
    *@dev Replace the current mintkey with new mintkey 
    *@param _newMintKey address of the new mintKey
    */
    function transferMintKey(address _newMintKey) external onlyOwner {
        require(_newMintKey != address(0), "new mint key cannot be 0x0");
        emit TransferMintKey(mintKey, _newMintKey);
        mintKey = _newMintKey;
    }
 
    /*
    ========================================
    Mint Pausing
    ========================================
    */

    /** 
    *@dev invalidates all mint request initiated before the current block 
    */
    function invalidateAllPendingMints() external onlyOwner {
        mintReqInValidBeforeThisBlock = block.number;
    }

    /** 
    *@dev pause any further mint request and mint finalizations 
    */
    function pauseMints() external onlyMintCheckerOrOwner {
        mintPaused = true;
        emit AllMintsPaused(true);
    }

    /** 
    *@dev unpause any further mint request and mint finalizations 
    */
    function unPauseMints() external onlyOwner {
        mintPaused = false;
        emit AllMintsPaused(false);
    }

    /** 
    *@dev pause a specific mint request
    *@param  _opIndex the index of the mint request the caller wants to pause
    */
    function pauseMint(uint _opIndex) external onlyMintCheckerOrOwner {
        mintOperations[_opIndex].paused = true;
        emit MintPaused(_opIndex, true);
    }

    /** 
    *@dev unpause a specific mint request
    *@param  _opIndex the index of the mint request the caller wants to unpause
    */
    function unpauseMint(uint _opIndex) external onlyOwner {
        mintOperations[_opIndex].paused = false;
        emit MintPaused(_opIndex, false);
    }

    /** 
    *@dev owner and mintchecker can specify a date on which mint actions are blocked
    (owner key can still mint)
    *@param  _year _month _day: the date that mint actions are blocked 
    */
    function addHoliday(uint16 _year, uint8 _month, uint8 _day) external onlyMintCheckerOrOwner {
        holidays[keccak256(_year, _month, _day)] = true;
        emit HolidayModified(_year, _month, _day, true);
    }

    /** 
    *@dev owner can lift the mint block on a day
    */
    function removeHoliday(uint16 _year, uint8 _month, uint8 _day) external onlyOwner {
        holidays[keccak256(_year, _month, _day)] = false;
        emit HolidayModified(_year, _month, _day, false);
    }


    /*
    ========================================
    set and claim contracts, administrative
    ========================================
    */

    /** 
    *@dev update address for the dateTime contract.
    */
    function setDateTime(address _newContract) external onlyOwner {
        dateTime = DateTimeAPI(_newContract);
        emit DateTimeAddressSet(_newContract);
    }

    /** 
    *@dev Update TrueUSD such that all Incoming delegate* calls from _source
    will be accepted by trueUSD.
    */
    function setDelegatedFrom(address _source) external onlyOwner {
        trueUSD.setDelegatedFrom(_source);
    }

    /** 
    *@dev Update this contract's trueUSD pointer to newContract (e.g. if the
    contract is upgraded)
    */
    function setTrueUSD(TrueUSD _newContract) external onlyOwner {
        trueUSD = _newContract;
        emit SetTrueUSD(_newContract);
    }

    /** 
    *@dev update TrueUSD's name and symbol
    */
    function changeTokenName(string _name, string _symbol) external onlyOwner {
        trueUSD.changeTokenName(_name, _symbol);
    }

    /** 
    *@dev Swap out TrueUSD's permissions registry
    *@param _registry new registry for trueUSD
    */
    function setTusdRegistry(Registry _registry) external onlyOwner {
        trueUSD.setRegistry(_registry);
    }

    /** 
    *@dev Claim ownership of an arbitrary Claimable contract
    */
    function issueClaimOwnership(address _other) public onlyOwner {
        Claimable other = Claimable(_other);
        other.claimOwnership();
    }

    // Future BurnableToken calls to trueUSD will be delegated to _delegate
    function delegateToNewContract(
        DelegateBurnable _delegate,
        Ownable _balanceSheet,
        Ownable _alowanceSheet) external onlyOwner {
        //initiate transfer ownership of storage contracts from trueUSD contract
        requestReclaimContract(_balanceSheet);
        requestReclaimContract(_alowanceSheet);
 
        //claim ownership of storage contract
        issueClaimOwnership(_balanceSheet);
        issueClaimOwnership(_alowanceSheet);

        //initiate transfer ownership of storage contracts to new delegate contract
        transferChild(_balanceSheet, _delegate);
        transferChild(_alowanceSheet, _delegate);

        //call to claim the storage contract with the new delegate contract
        require(address(_delegate).call(bytes4(keccak256("setBalanceSheet(address)")), _balanceSheet));
        require(address(_delegate).call(bytes4(keccak256("setAllowanceSheet(address)")), _alowanceSheet));

        trueUSD.delegateToNewContract(_delegate);
    }

    /** 
    *@dev Transfer ownership of _child to _newOwner.
    Can be used e.g. to upgrade this TimeLockedController contract.
    *@param _child contract that timeLockController currently Owns 
    *@param _newOwner new owner/pending owner of _child
    */
    function transferChild(Ownable _child, address _newOwner) public onlyOwner {
        _child.transferOwnership(_newOwner);
        emit TransferChild(_child, _newOwner);
    }

    /** 
    *@dev Transfer ownership of a contract from trueUSD to this TimeLockedController.
    Can be used e.g. to reclaim balance sheet
    in order to transfer it to an upgraded TrueUSD contract.
    *@param _other address of the contract to claim ownership of
    */
    function requestReclaimContract(Ownable _other) public onlyOwner {
        trueUSD.reclaimContract(_other);
        emit RequestReclaimContract(_other);
    }

    /** 
    *@dev send all ether in trueUSD address to the owner of timeLockController 
    */
    function requestReclaimEther() external onlyOwner {
        trueUSD.reclaimEther(owner);
    }

    /** 
    *@dev transfer all tokens of a particular type in trueUSD address to the
    owner of timeLockController 
    *@param _token token address of the token to transfer
    */
    function requestReclaimToken(ERC20 _token) external onlyOwner {
        trueUSD.reclaimToken(_token, owner);
    }

    /** 
    *@dev set new contract to which tokens look to to see if it's on the supported fork
    *@param _newGlobalPause address of the new contract
    */
    function setGlobalPause(address _newGlobalPause) external onlyOwner {
        trueUSD.setGlobalPause(_newGlobalPause);
    }

    /** 
    *@dev set new contract to which specified address can send eth to to quickly pause trueUSD
    *@param _newFastPause address of the new contract
    */
    function setTrueUsdFastPause(address _newFastPause) external onlyOwner {
        trueUsdFastPause = _newFastPause;
        emit TrueUsdFastPauseSet(_newFastPause);
    }

    /** 
    *@dev pause all pausable actions on TrueUSD, mints/burn/transfer/approve
    */
    function pauseTrueUSD() external onlyFastPauseOrOwner {
        trueUSD.pause();
    }

    /** 
    *@dev unpause all pausable actions on TrueUSD, mints/burn/transfer/approve
    */
    function unpauseTrueUSD() external onlyOwner {
        trueUSD.unpause();
    }
    
    /** 
    *@dev wipe balance of a blacklisted address
    *@param _blacklistedAddress address whose balance will be wiped
    */
    function wipeBlackListedTrueUSD(address _blacklistedAddress) external onlyOwner {
        trueUSD.wipeBlacklistedAccount(_blacklistedAddress);
    }

    /** 
    *@dev Change the minimum and maximum amounts that TrueUSD users can
    burn to newMin and newMax
    *@param _min minimum amount user can burn at a time
    *@param _max maximum amount user can burn at a time
    */
    function setBurnBounds(uint256 _min, uint256 _max) external onlyOwner {
        trueUSD.setBurnBounds(_min, _max);
    }

    /** 
    *@dev Change the transaction fees charged on transfer/mint/burn
    */
    function changeStakingFees(
        uint256 _transferFeeNumerator,
        uint256 _transferFeeDenominator,
        uint256 _mintFeeNumerator,
        uint256 _mintFeeDenominator,
        uint256 _mintFeeFlat,
        uint256 _burnFeeNumerator,
        uint256 _burnFeeDenominator,
        uint256 _burnFeeFlat) external onlyOwner {
        trueUSD.changeStakingFees(
            _transferFeeNumerator,
            _transferFeeDenominator,
            _mintFeeNumerator,
            _mintFeeDenominator,
            _mintFeeFlat,
            _burnFeeNumerator,
            _burnFeeDenominator,
            _burnFeeFlat);
    }

    /** 
    *@dev Change the recipient of staking fees to newStaker
    *@param _newStaker new staker to send staking fess to
    */
    function changeStaker(address _newStaker) external onlyOwner {
        trueUSD.changeStaker(_newStaker);
    }
}
