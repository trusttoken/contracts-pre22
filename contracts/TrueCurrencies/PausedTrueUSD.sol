pragma solidity 0.5.13;

import "./utilities/PausedToken.sol";

contract PausedTrueUSD is PausedDelegateERC20 {
    function name() public pure returns (string memory) {
        return "TrueUSD";
    }

    function symbol() public pure returns (string memory) {
        return "TUSD";
    }
}