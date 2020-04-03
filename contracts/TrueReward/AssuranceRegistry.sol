pragma solidity ^0.5.13;

import "./FinancialOpportunity.sol";
import "../utilities/FractionalExponents.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@trusttoken/trusttokens/contracts/StakingOpportunityFactory.sol";
import "../mocks/SimpleLiquidatorMock.sol";

/**
 * Assurance Registry
 *
 * Register financial opportunities as assured opportunities.
 * Functions are basically the same as AssuredFinancialOpportunity except
 * each function has a _to paramater that maps to assuranceData
**/
contract AssuranceRegistry is OwnedUpgradeabilityProxy {
    using SafeMath for uint256;

    uint32 constant TOTAL_ASSURANCE_BASIS = 10000;

    FractionalExponents exponentContract;
    StakingOpportunityFactory stakingOpportunityFactory;
    StakingAsset stakeAsset;
    StakingAsset rewardAsset;

    event RegisterOpportunity();

    // TODO: store this in proxy storage
    struct AssuranceData {
        uint zTUSDIssued;
        uint32 assuranceBasis;
        FinancialOpportunity opportunityAddress;
        StakedToken assuranceAddress;
        ILiquidator liquidatorAddress;
    }

    mapping(uint => AssuranceData) private _assuranceRegistry;
    uint nextId = 0;
    uint32 defaultAssuranceBasis = 3000; // TOTAL_ASSURANCE_BASIS = 100%

    function configure(
        FractionalExponents _exponentContract,
        StakingOpportunityFactory _stakingOpportunityFactory,
        StakingAsset _stakeAsset,
        StakingAsset _rewardAsset
    ) external onlyProxyOwner {
        exponentContract = _exponentContract;
        stakingOpportunityFactory = _stakingOpportunityFactory;
        stakeAsset = _stakeAsset;
        rewardAsset = _rewardAsset;
    }

    modifier registeredFinOp(uint _id) {
        require(_assuranceRegistry[_id].opportunityAddress != FinancialOpportunity(0));
        _;
    }

    function opportunity(uint _id) public view returns(FinancialOpportunity) {
        return _assuranceRegistry[_id].opportunityAddress;
    }

    function assuranceBasis(uint _id) public view returns(uint32) {
        return _assuranceRegistry[_id].assuranceBasis;
    }

    function assurance(uint _id) public view returns(StakedToken) {
        return _assuranceRegistry[_id].assuranceAddress;
    }

    function liquidator(uint _id) public view returns(ILiquidator) {
        return _assuranceRegistry[_id].liquidatorAddress;
    }

    function register(address _opportunity) external returns(uint) {
        uint id = nextId++;

        ILiquidator liquidatorAddress = new SimpleLiquidatorMock(rewardAsset);
        StakedToken assuranceAddress = stakingOpportunityFactory.createProxyStakingOpportunity(
            stakeAsset,
            rewardAsset,
            address(liquidatorAddress)
        );

        _assuranceRegistry[id].assuranceAddress = assuranceAddress;
        _assuranceRegistry[id].liquidatorAddress = liquidatorAddress;
        _assuranceRegistry[id].opportunityAddress = FinancialOpportunity(_opportunity);
        _assuranceRegistry[id].assuranceBasis = defaultAssuranceBasis;
        _assuranceRegistry[id].zTUSDIssued = 0;

        return id;
    }

    function getBalance(uint _id) public view registeredFinOp(_id) returns (uint) {
        return _assuranceRegistry[_id].zTUSDIssued;
    }

    // perTokenValue = opportunity().perTokenValue() ^ (1 - assuranceBasis)
    function perTokenValue(uint _id) public view registeredFinOp(_id) returns (uint256) {
        // result = (_baseN / _baseD) ^ (_expN / _expD) * 2 ^ precision
        (uint result, uint8 precision) = exponentContract.power(
            opportunity(_id).perTokenValue(), 10**18,
            TOTAL_ASSURANCE_BASIS - assuranceBasis(_id), TOTAL_ASSURANCE_BASIS);
        return result.mul(10**18).div(2 ** uint256(precision));
    }

    function deposit(uint _id, address _account, uint _amount) external registeredFinOp(_id) returns (uint) {
        uint shares = opportunity(_id).deposit(_account, _amount);

        _assuranceRegistry[_id].zTUSDIssued = _assuranceRegistry[_id].zTUSDIssued.add(shares);
        return shares;
    }

    function withdrawTo(uint _id, address _to, uint _amount)
        external
        registeredFinOp(_id)
        returns (uint)
    {
        require(_amount <= getBalance(_id).mul(perTokenValue(_id)).div(10**18), "cannot withdraw more than is available");
        (bool success, uint returnedAmount) = _attemptWithdrawTo(_id, _to, _amount);
        if (success) {
            _assuranceRegistry[_id].zTUSDIssued = _assuranceRegistry[_id].zTUSDIssued.sub(returnedAmount);
            return returnedAmount;
        } else {
            _liquidate(_id, _to, _amount);
            return _amount / perTokenValue(_id);
        }
    }

    event LogAwardPool(uint amount);

    function awardPool(uint _id) external registeredFinOp(_id) {
        // rewardAmount = (opportunityValue * opportunityBalance) - (assuredOpportunityBalance * assuredOpportunityTokenValue)
        uint awardAmount = opportunity(_id).perTokenValue().mul(opportunity(_id).getBalance()).div(10**18)
            .sub(getBalance(_id).mul(perTokenValue(_id)).div(10**18));

        emit LogAwardPool(awardAmount);

        (bool success, uint returnedAmount) = _attemptWithdrawTo(_id, address(assurance(_id)), awardAmount);
        require(success, "withdrawal failed");
    }

    function _liquidate(uint _id, address _receiver, uint256 _debt) internal {
        liquidator(_id).reclaim(_receiver, int256(_debt));
    }

    function _attemptWithdrawTo(uint _id, address _to, uint _amount) internal returns (bool, uint) {
        FinancialOpportunity finOp = opportunity(_id);

        (bool success, bytes memory returnData) = address(finOp).call(
            abi.encodePacked(finOp.withdrawTo.selector, abi.encode(_to, _amount))
        );

        return (
            success,
            success ? abi.decode(returnData, (uint)) : 0
        );
    }
}
