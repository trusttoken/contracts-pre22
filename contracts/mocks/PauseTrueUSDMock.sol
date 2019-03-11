pragma solidity ^0.4.23;

import "../utilities/PausedTrueUSD.sol";

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
