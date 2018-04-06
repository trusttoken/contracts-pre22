pragma solidity ^0.4.18;

import "./modularERC20/ModularBurnableToken.sol";
import "./modularERC20/ModularMintableToken.sol";
import "./AddressList.sol";

contract TokenWithFees is ModularMintableToken, ModularBurnableToken {
    AddressList public noFeesList;

    uint256 public transferFeeNumerator = 7;
    uint256 public transferFeeDenominator = 10000;
    uint256 public mintFeeNumerator = 0;
    uint256 public mintFeeDenominator = 10000;
    uint256 public mintFeeFlat = 0;
    uint256 public burnFeeNumerator = 0;
    uint256 public burnFeeDenominator = 10000;
    uint256 public burnFeeFlat = 0;
    address public staker;

    event SetNoFeesList(address indexed list);
    event ChangeStaker(address indexed addr);

    function TokenWithFees() public {
        staker = msg.sender;
    }

    function setNoFeesList(AddressList _noFeesList) onlyOwner public {
        noFeesList = _noFeesList;
        emit SetNoFeesList(_noFeesList);
    }

    function burnAllArgs(address _burner, uint256 _value) internal {
        uint256 fee = payStakingFee(_burner, _value, burnFeeNumerator, burnFeeDenominator, burnFeeFlat, address(0));
        uint256 remaining = _value.sub(fee);
        super.burnAllArgs(_burner, remaining);
    }

    function mint(address _to, uint256 _amount) onlyOwner public returns (bool) {
        super.mint(_to, _amount);
        payStakingFee(_to, _amount, mintFeeNumerator, mintFeeDenominator, mintFeeFlat, address(0));
    }

    // transfer and transferFrom both call this function, so pay staking fee here.
    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        super.transferAllArgs(_from, _to, _value);
        payStakingFee(_to, _value, transferFeeNumerator, transferFeeDenominator, 0, _from);
    }

    function payStakingFee(address _payer, uint256 _value, uint256 _numerator, uint256 _denominator, uint256 _flatRate, address _otherParticipant) private returns (uint256) {
        if (noFeesList.onList(_payer) || noFeesList.onList(_otherParticipant)) {
            return 0;
        }
        uint256 stakingFee = _value.mul(_numerator).div(_denominator).add(_flatRate);
        if (stakingFee > 0) {
            super.transferAllArgs(_payer, staker, stakingFee);
        }
        return stakingFee;
    }

    function changeStakingFees(uint256 _transferFeeNumerator,
                               uint256 _transferFeeDenominator,
                               uint256 _mintFeeNumerator,
                               uint256 _mintFeeDenominator,
                               uint256 _mintFeeFlat,
                               uint256 _burnFeeNumerator,
                               uint256 _burnFeeDenominator,
                               uint256 _burnFeeFlat) public onlyOwner {
        require(_transferFeeDenominator != 0);
        require(_mintFeeDenominator != 0);
        require(_burnFeeDenominator != 0);
        transferFeeNumerator = _transferFeeNumerator;
        transferFeeDenominator = _transferFeeDenominator;
        mintFeeNumerator = _mintFeeNumerator;
        mintFeeDenominator = _mintFeeDenominator;
        mintFeeFlat = _mintFeeFlat;
        burnFeeNumerator = _burnFeeNumerator;
        burnFeeDenominator = _burnFeeDenominator;
        burnFeeFlat = _burnFeeFlat;
    }

    function changeStaker(address _newStaker) public onlyOwner {
        require(_newStaker != address(0));
        staker = _newStaker;
        emit ChangeStaker(_newStaker);
    }
}
