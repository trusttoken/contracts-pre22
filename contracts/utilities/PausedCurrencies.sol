pragma solidity ^0.4.23;

import "./PausedTrueUSD.sol";

contract PausedAUD is PausedTrueUSD {
    function name() public pure returns (string) {
        return "TrueAUD";
    }

    function symbol() public pure returns (string) {
        return "TAUD";
    }
}

contract PausedGBP is PausedTrueUSD {
    function name() public pure returns (string) {
        return "TrueGBP";
    }

    function symbol() public pure returns (string) {
        return "TGBP";
    }
}

contract PausedCAD is PausedTrueUSD {
    function name() public pure returns (string) {
        return "TrueCAD";
    }

    function symbol() public pure returns (string) {
        return "TCAD";
    }
}
