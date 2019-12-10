pragma solidity ^0.5.13;

import "./PausedToken.sol";

contract PausedTrueUSD is PausedDelegateERC20 {
    function name() public pure returns (string memory) {
        return "TrueUSD";
    }

    function symbol() public pure returns (string memory) {
        return "TUSD";
    }
}

contract PausedAUD is PausedToken {
    function name() public pure returns (string memory) {
        return "TrueAUD";
    }

    function symbol() public pure returns (string memory) {
        return "TAUD";
    }
}

contract PausedGBP is PausedToken {
    function name() public pure returns (string memory) {
        return "TrueGBP";
    }

    function symbol() public pure returns (string memory) {
        return "TGBP";
    }
}

contract PausedCAD is PausedToken {
    function name() public pure returns (string memory) {
        return "TrueCAD";
    }

    function symbol() public pure returns (string memory) {
        return "TCAD";
    }
}

contract PausedHKD is PausedToken {
    function name() public pure returns (string memory) {
        return "TrueHKD";
    }

    function symbol() public pure returns (string memory) {
        return "THKD";
    }
}
