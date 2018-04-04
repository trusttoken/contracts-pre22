pragma solidity ^0.4.18;

import "../zeppelin-solidity/contracts/token/ERC20/BurnableToken.sol";
import "../zeppelin-solidity/contracts/token/ERC20/MintableToken.sol";
import "./AddressList.sol";

contract TokenWithFees is MintableToken, BurnableToken {
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

    function TokenWithFees() public {
        staker = msg.sender;
    }

    function setNoFeesList(AddressList _noFeesList) onlyOwner public {
        noFeesList = _noFeesList;
    }

    function burnAllArgs(address burner, uint256 _value) internal {
        uint256 fee = payStakingFee(burner, _value, burnFeeNumerator, burnFeeDenominator, burnFeeFlat, 0x0);
        uint256 remaining = _value.sub(fee);
        super.burnAllArgs(burner, remaining);
    }

    function mint(address _to, uint256 _amount) onlyOwner public returns (bool) {
        super.mint(_to, _amount);
        payStakingFee(_to, _amount, mintFeeNumerator, mintFeeDenominator, mintFeeFlat, 0x0);
    }

    // transfer and transferFrom both call this function, so pay staking fee here.
    function transferAllArgs(address _from, address _to, uint256 _value) internal {
        super.transferAllArgs(_from, _to, _value);
        payStakingFee(_to, _value, transferFeeNumerator, transferFeeDenominator, 0, _from);
    }

    function payStakingFee(address payer, uint256 value, uint256 numerator, uint256 denominator, uint256 flatRate, address otherParticipant) private returns (uint256) {
        if (noFeesList.onList(payer) || noFeesList.onList(otherParticipant)) {
            return 0;
        }
        uint256 stakingFee = value.mul(numerator).div(denominator).add(flatRate);
        if (stakingFee > 0) {
            super.transferAllArgs(payer, staker, stakingFee);
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

    function changeStaker(address newStaker) public onlyOwner {
        require(newStaker != address(0));
        staker = newStaker;
    }
}
