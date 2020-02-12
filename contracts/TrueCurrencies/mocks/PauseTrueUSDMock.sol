pragma solidity ^0.5.13;

import "../utilities/PausedCurrencies.sol";

contract PausedTrueUSDMock is PausedTrueUSD{
    address public delegateFrom;

    function setDelegateFrom(address _delegateFrom) external {
        delegateFrom = _delegateFrom;
    }

    modifier onlyDelegateFrom() {
        require(msg.sender == delegateFrom);
        _;
    }

}
