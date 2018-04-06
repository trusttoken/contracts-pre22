pragma solidity ^0.4.18;

import "./modularERC20/ModularPausableToken.sol";
// TrueUSD *is* supposed to own 'balances' and 'allowances', but it needs to be able to relinquish them:
import "zeppelin-solidity/contracts/ownership/NoOwner.sol";
import "./CanDelegate.sol";
import "./BurnableTokenWithBounds.sol";
import "./GatedToken.sol";
import "./TokenWithFees.sol";
import "./StandardDelegate.sol";

contract TrueUSD is ModularPausableToken, NoOwner, BurnableTokenWithBounds, GatedToken, TokenWithFees, StandardDelegate, CanDelegate {
    string public name = "TrueUSD";
    string public symbol = "TUSD";
    uint8 public constant decimals = 18;

    event TokenNameChanged(string newName, string newSymbol);

    function TrueUSD() public {
        totalSupply_ = 0;
        burnMin = 10000 * 10**uint256(decimals);
        burnMax = 20000000 * 10**uint256(decimals);
    }

    function changeName(string _name, string _symbol) onlyOwner public {
        name = _name;
        symbol = _symbol;
        emit TokenNameChanged(_name, _symbol);
    }

    // disable most onlyOwner functions upon delegation, since the owner should
    // use the new version of the contract
    modifier onlyWhenNoDelegate() {
        require(address(delegate) == 0x0);
        _;
    }

    //TODO: block gas limit is insufficient to include all these?
    function setNoFeesList(AddressList _noFeesList) onlyWhenNoDelegate public {
        super.setNoFeesList(_noFeesList);
    }
    function mint(address _to, uint256 _amount) onlyWhenNoDelegate public returns (bool) {
        super.mint(_to, _amount);
    }
    function setBalanceSheet(address sheet) onlyWhenNoDelegate public {
        super.setBalanceSheet(sheet);
    }
    function setAllowanceSheet(address sheet) onlyWhenNoDelegate public {
        super.setAllowanceSheet(sheet);
    }
    function changeBurnBounds(uint256 newMin, uint256 newMax) onlyWhenNoDelegate public {
        super.changeBurnBounds(newMin, newMax);
    }
    // function setLists(AddressList _canReceiveMintWhiteList, AddressList _canBurnWhiteList, AddressList _blackList) onlyWhenNoDelegate public {
    //     super.setLists(_canReceiveMintWhiteList, _canBurnWhiteList, _blackList);
    // }
    // function changeStaker(address newStaker) onlyWhenNoDelegate public {
    //     super.changeStaker(newStaker);
    // }
    // function wipeBlacklistedAccount(address account) onlyWhenNoDelegate public {
    //     super.wipeBlacklistedAccount(account);
    // }
    // function changeStakingFees(
    //     uint256 _transferFeeNumerator,
    //     uint256 _transferFeeDenominator,
    //     uint256 _mintFeeNumerator,
    //     uint256 _mintFeeDenominator,
    //     uint256 _mintFeeFlat,
    //     uint256 _burnFeeNumerator,
    //     uint256 _burnFeeDenominator,
    //     uint256 _burnFeeFlat
    // ) onlyWhenNoDelegate public {
    //     super.changeStakingFees(
    //         _transferFeeNumerator,
    //         _transferFeeDenominator,
    //         _mintFeeNumerator,
    //         _mintFeeDenominator,
    //         _mintFeeFlat,
    //         _burnFeeNumerator,
    //         _burnFeeDenominator,
    //         _burnFeeFlat
    //     );
    // }
}
