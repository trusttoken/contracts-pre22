pragma solidity ^0.4.23;

import "openzeppelin-solidity/contracts/ownership/HasNoEther.sol";
import "openzeppelin-solidity/contracts/ownership/HasNoTokens.sol";
import "openzeppelin-solidity/contracts/ownership/Claimable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./TrueUSD.sol";
import "./utilities/DateTime.sol";
import "../registry/contracts/HasRegistry.sol";



// This contract allows us to split ownership of the TrueUSD contract (and TrueUSD's Registry)
// into two addresses. One, called the "owner" address, has unfettered control of the TrueUSD contract -
// it can mint new tokens, transfer ownership of the contract, etc. However to make
// extra sure that TrueUSD is never compromised, this owner key will not be used in
// day-to-day operations, allowing it to be stored at a heightened level of security.
// Instead, the owner appoints an "admin" address. The admin will be used in everyday operation,
// but is restricted to performing only a few tasks like updating the Registry and minting
// new tokens. Additionally, the admin can
// only mint new tokens by calling a pair of functions - `requestMint`
// and `finalizeMint` - with (roughly) 24 hours in between the two calls.
// This allows us to watch the blockchain and if we discover the admin has been
// compromised and there are unauthorized operations underway, we can use the owner key
// to replace the admin. Requests initiated by an admin that has since been deposed
// cannot be finalized.
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


    mapping(bytes32 => bool) public holidays;


    bool public mintPaused;
    uint256 public smallMintThreshold;
    uint8 public minSmallMintApproval;
    uint8 public minLargeMintApproval;
    uint256 public dailyMintLimit;
    uint256 public mintedToday;
    uint256 public timeOfLastMint;
    uint256 public mintReqValidBeforeThisBlock;
    address public mintKey;
    TrueUSD public trueUSD;
    DateTimeAPI public dateTime;
    MintOperation[] public mintOperations;
    TimeOfDay[] public mintCheckTimes;

    uint256 public timeZoneDiff = 7 hours;
    uint8 public resetTime;

    string constant public IS_MINT_CHECKER = "isTUSDMintChecker";
    string constant public IS_MINT_APPROVER = "isTUSDMintApprover";

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

    modifier mintNotPaused() {
        if (msg.sender != owner) {
            require(!mintPaused, "minting is paused");
        }
        _;
    }

    modifier notOnWeekend(){
        if (msg.sender != owner){
            require(dateTime.getWeekday(now - timeZoneDiff) != 0);
            require(dateTime.getWeekday(now - timeZoneDiff) != 6);
        }
        _;
    }

    modifier notOnHoliday(){
        if (msg.sender != owner){
            uint year = dateTime.getYear(now - timeZoneDiff);
            uint month = dateTime.getMonth(now - timeZoneDiff);
            uint day = dateTime.getDay(now - timeZoneDiff);
            require(!holidays[keccak256(year, month, day)]);
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
    event ApprovalThresholdChanged(uint smallMintApproval, uint largeMintApproval);
    event SmallMintThresholdChanged(uint oldThreshold, uint newThreshold);
    event DailyLimitChanged(uint oldLimit, uint newLimit);
    event HolidayModified(uint year, uint month, uint day, bool status);
    event AddMintCheckTime(uint8 hour, uint8 minute);
    event RemoveMintCheckTime(uint8 hour, uint8 minute);
    event DateTimeAddressSet(address newDateTimeContract);


    /*
    ========================================
    Minting functions
    ========================================
    */

    function addMintCheckTime(uint8 _hour, uint8 _minute) public onlyOwner {
        TimeOfDay memory time = TimeOfDay(_hour, _minute);
        mintCheckTimes.push(time);
        emit AddMintCheckTime(_hour, _minute);
    } 

    function removeMintCheckTime(uint _index) public onlyOwner returns(bool) {
        if (_index >= mintCheckTimes.length) return false;
        TimeOfDay memory time = mintCheckTimes[_index];
        emit RemoveMintCheckTime(time.hour, time.minute);
        for (uint i = _index; i<mintCheckTimes.length-1; i++) {
            mintCheckTimes[i] = mintCheckTimes[i+1];
        }
        delete mintCheckTimes[mintCheckTimes.length-1];
        mintCheckTimes.length--;
        return true;
    }

    function numberOfCheckTimes() public view returns(uint) {
        return mintCheckTimes.length;
    }

    function setSmallMintThreshold(uint256 _threshold) public onlyOwner{
        emit SmallMintThresholdChanged(smallMintThreshold,_threshold);
        smallMintThreshold = _threshold;
    }

    function setMinimalApprovals(uint8 _smallMintApproval, uint8 _largeMintApproval) public onlyOwner{
        minSmallMintApproval = _smallMintApproval;
        minLargeMintApproval = _largeMintApproval;
        emit ApprovalThresholdChanged(_smallMintApproval, _largeMintApproval);
    }

    function setMintLimit(uint256 _limit) public onlyOwner{
        emit DailyLimitChanged( dailyMintLimit, _limit);
        dailyMintLimit = _limit;
    }

    function resetMintedToday() public onlyOwner{
        mintedToday = 0;
        emit MintLimitReset(msg.sender);
    }

    // mintKey initiates a request to mint _value TrueUSD for account _to
    function requestMint(address _to, uint256 _value) public mintNotPaused notOnHoliday notOnWeekend onlyMintKeyOrOwner {
        uint currentTimeZoneTime = now - timeZoneDiff;
        //remove the not on holiday and not on weekend modifier
        if (dateTime.getMonth(currentTimeZoneTime + resetTime) == dateTime.getMonth(timeOfLastMint + resetTime) &&
            dateTime.getDay(currentTimeZoneTime + resetTime) == dateTime.getDay(timeOfLastMint + resetTime)){
            mintedToday = mintedToday.add(_value);
            require(mintedToday <= dailyMintLimit, "over the mint limit");
        }else{
            mintedToday = _value;
        }
        timeOfLastMint = currentTimeZoneTime;
        MintOperation memory op = MintOperation(_to, _value, block.number, currentTimeZoneTime, 0, false);
        emit RequestMint(_to, msg.sender, _value, timeOfLastMint, mintOperations.length);
        mintOperations.push(op);
    }


    function enoughTimePassed(uint256 requestedTime) public view returns (bool) {
        //write our modified version so that i can just make one call
        uint16 year = dateTime.getYear(now - timeZoneDiff);
        uint8 month = dateTime.getMonth(now - timeZoneDiff);
        uint8 day = dateTime.getDay(now - timeZoneDiff);

        uint16 yesterdayYear = dateTime.getYear(now - 1 days - timeZoneDiff);
        uint8 yesterdayMonth = dateTime.getMonth(now - 1 days - timeZoneDiff);
        uint8 yesterday = dateTime.getDay(now - 1 days - timeZoneDiff);

        uint checkTime;

        for (uint i; i <mintCheckTimes.length; i++){
            checkTime = dateTime.toTimestamp(yesterdayYear,yesterdayMonth, yesterday, mintCheckTimes[i].hour, mintCheckTimes[i].minute) + timeZoneDiff;
            if(requestedTime + timeZoneDiff + 30 minutes <= checkTime){
                return true;
            }
            checkTime = dateTime.toTimestamp(year,month, day, mintCheckTimes[i].hour, mintCheckTimes[i].minute) + timeZoneDiff;
            if (now >= checkTime + 2 hours){
                if(requestedTime+ timeZoneDiff + 30 minutes < checkTime){
                    return true;
                }
            }
        }
        return false;
    }


    function hasEnoughApproval(uint256 numberOfApproval, uint256 value) public view returns (bool) {
         if (value < smallMintThreshold){
            if(numberOfApproval < minSmallMintApproval){
                return false;
            }
         }else{
            if(numberOfApproval < minLargeMintApproval){
                return false;
            }
         }
         return true;
    }

    function canFinalize(uint256 _index) public constant notOnHoliday notOnWeekend returns(bool) {
        MintOperation memory op = mintOperations[_index];
        require(op.requestedBlock > mintReqValidBeforeThisBlock);
        require(!op.paused);
        require(enoughTimePassed(op.timeRequested)); //checks that enough time has elapsed
        require(hasEnoughApproval(op.numberOfApproval, op.value));
        return true;
    }

    // after a day, mintKey finalizes mint request by providing the
    // index of the request (visible in the RequestMint event accompanying the original request)
    function finalizeMint(uint256 _index) public mintNotPaused notOnHoliday notOnWeekend onlyMintKeyOrOwner {
        if (msg.sender == mintKey){
            require(canFinalize(_index));
        }
        MintOperation memory op = mintOperations[_index];
        address to = op.to;
        uint256 value = op.value;
        delete mintOperations[_index];
        emit FinalizeMint(to, msg.sender, value, _index);
        trueUSD.mint(to, value);
    }

    function approveMint(uint256 _index) public onlyMintApproverOrOwner {
        //check gas optimization is it better to store to memory first
        require(!mintOperations[_index].approved[msg.sender]);
        mintOperations[_index].approved[msg.sender] =true;
        mintOperations[_index].numberOfApproval = mintOperations[_index].numberOfApproval.add(1);//safe math
        emit MintApproved(msg.sender, _index);
    }

    function revokeMint(uint256 _index) public onlyMintKeyOrOwner {
        delete mintOperations[_index];
        emit RevokeMint(_index);
    }

    function returnTime() public view returns(uint256){
        return now  - timeZoneDiff;
    }



    /*
    ========================================
    Key management
    ========================================
    */

    // Replace the current admin with newAdmin. This should be rare (e.g. if admin
    // is compromised), and will invalidate all pending mint operations (including
    // any the owner may have made and not yet finalized)
    function transferMintKey(address _newMintKey) public onlyOwner {
        require(_newMintKey != address(0),"new mint key cannot be 0x0");
        emit TransferMintKey( mintKey, _newMintKey);
        mintKey = _newMintKey;
    }
 

    /*
    ========================================
    Mint Pausing
    ========================================
    */

    function invalidateAllPendingMints() public onlyOwner {
        mintReqValidBeforeThisBlock = block.number;
    }
    
    function pauseMints() public onlyMintCheckerOrOwner {
        mintPaused = true;
        emit AllMintsPaused(true);
    }


    function unPauseMints() public onlyOwner{
        mintPaused = false;
        emit AllMintsPaused(false);
    }


    function pauseMint(uint _opIndex) public onlyMintCheckerOrOwner {
        mintOperations[_opIndex].paused = true;
        emit MintPaused( _opIndex , true);
    }

    function unpauseMint(uint _opIndex) public onlyOwner {
        mintOperations[_opIndex].paused = false;
        emit MintPaused( _opIndex , false);
    }

    
    function addHoliday(uint _year, uint _month, uint _day) onlyMintCheckerOrOwner {
        holidays[keccak256(_year, _month, _day)] = true;
        emit HolidayModified(_year, _month, _day, true);
    }

    function removeHoliday(uint _year, uint _month, uint _day) onlyOwner {
        holidays[keccak256(_year, _month, _day)] = false;
        emit HolidayModified(_year, _month, _day, false);
    }


    /*
    ========================================
    set and claim contracts, administrative
    ========================================
    */

    function setDateTime(address _newContract) public onlyOwner{
        dateTime = DateTimeAPI(_newContract);
        emit DateTimeAddressSet(_newContract);
    }

    // Incoming delegate* calls from _source will be accepted by trueUSD
    function setDelegatedFrom(address _source) public onlyOwner {
        trueUSD.setDelegatedFrom(_source);
    }


    // Update this contract's trueUSD pointer to newContract (e.g. if the
    // contract is upgraded)
    function setTrueUSD(TrueUSD _newContract) public onlyOwner {
        emit SetTrueUSD(_newContract);
        trueUSD = _newContract;
    }

    // change trueUSD's name and symbol
    function changeTokenName(string _name, string _symbol) public onlyOwner {
        trueUSD.changeTokenName(_name, _symbol);
    }

    // Swap out TrueUSD's permissions registry
    function setTusdRegistry(Registry _registry) onlyOwner public {
        trueUSD.setRegistry(_registry);
    }

    // Claim ownership of an arbitrary Claimable contract
    function issueClaimOwnership(address _other) public onlyOwner {
        Claimable other = Claimable(_other);
        other.claimOwnership();
    }

    // Future BurnableToken calls to trueUSD will be delegated to _delegate
    function delegateToNewContract(DelegateBurnable _delegate,
                                   Ownable _balanceSheet,
                                   Ownable _alowanceSheet)public onlyOwner{
        //initiate transfer ownership of storage contracts from trueUSD contract
        requestReclaimContract(_balanceSheet);
        requestReclaimContract(_alowanceSheet);

        //claim ownership of storage contract
        issueClaimOwnership(_balanceSheet);
        issueClaimOwnership(_alowanceSheet);

        //initiate transfer ownership of storage contracts to new delegate contract
        transferChild(_balanceSheet,_delegate);
        transferChild(_alowanceSheet,_delegate);

        //call to claim the storage contract with the new delegate contract
        require(address(_delegate).call(bytes4(keccak256("setBalanceSheet(address)")), _balanceSheet));
        require(address(_delegate).call(bytes4(keccak256("setAllowanceSheet(address)")), _alowanceSheet));


        trueUSD.delegateToNewContract(_delegate);

    }


    // Transfer ownership of _child to _newOwner
    // Can be used e.g. to upgrade this TimeLockedController contract.
    function transferChild(Ownable _child, address _newOwner) public onlyOwner {
        emit TransferChild(_child, _newOwner);
        _child.transferOwnership(_newOwner);
    }

    // Transfer ownership of a contract from trueUSD
    // to this TimeLockedController. Can be used e.g. to reclaim balance sheet
    // in order to transfer it to an upgraded TrueUSD contract.
    function requestReclaimContract(Ownable _other) public onlyOwner {
        emit RequestReclaimContract(_other);
        trueUSD.reclaimContract(_other);
    }

    function requestReclaimEther() public onlyOwner {
        trueUSD.reclaimEther(owner);
    }

    function requestReclaimToken(ERC20 _token) public onlyOwner {
        trueUSD.reclaimToken(_token, owner);
    }

    // Change the minimum and maximum amounts that TrueUSD users can
    // burn to newMin and newMax
    function setBurnBounds(uint256 _min, uint256 _max) public onlyOwner {
        trueUSD.setBurnBounds(_min, _max);
    }

    // Change the transaction fees charged on transfer/mint/burn
    function changeStakingFees(uint256 _transferFeeNumerator,
                               uint256 _transferFeeDenominator,
                               uint256 _mintFeeNumerator,
                               uint256 _mintFeeDenominator,
                               uint256 _mintFeeFlat,
                               uint256 _burnFeeNumerator,
                               uint256 _burnFeeDenominator,
                               uint256 _burnFeeFlat) public onlyOwner {
        trueUSD.changeStakingFees(_transferFeeNumerator,
                                  _transferFeeDenominator,
                                  _mintFeeNumerator,
                                  _mintFeeDenominator,
                                  _mintFeeFlat,
                                  _burnFeeNumerator,
                                  _burnFeeDenominator,
                                  _burnFeeFlat);
    }

    // Change the recipient of staking fees to newStaker
    function changeStaker(address _newStaker) public onlyOwner {
        trueUSD.changeStaker(_newStaker);
    }



}
