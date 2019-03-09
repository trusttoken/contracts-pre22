pragma solidity ^0.4.23;

import "./PausedToken.sol";

contract PausedTrueUSD is PausedDelegateERC20 {
    function name() public pure returns (string) {
        return "TrueUSD";
    }

    function symbol() public pure returns (string) {
        return "TUSD";
    }
}

contract PausedAUD is PausedToken {
    function name() public pure returns (string) {
        return "TrueAUD";
    }

    function symbol() public pure returns (string) {
        return "TAUD";
    }
}

contract PausedGBP is PausedToken {
    function name() public pure returns (string) {
        return "TrueGBP";
    }

    function symbol() public pure returns (string) {
        return "TGBP";
    }
}

contract PausedCAD is PausedToken {
    function name() public pure returns (string) {
        return "TrueCAD";
    }

    function symbol() public pure returns (string) {
        return "TCAD";
    }
}
