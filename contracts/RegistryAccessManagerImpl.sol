pragma solidity ^0.4.18;

import "./Registry.sol";
import "./RegistryAccessManager.sol";

contract RegistryAccessManagerImpl is RegistryAccessManager {
    string public constant WRITE_PERMISSION = "canWriteTo";

    function confirmWrite(address /*_who*/, string _attribute, uint256 /*_value*/, address _admin) public returns (bool) {
        return Registry(msg.sender).hasAttribute(_admin, strConcat(WRITE_PERMISSION, _attribute));
    }

    // Based on https://github.com/oraclize/ethereum-api/blob/master/oraclizeAPI_0.5.sol#L830
    function strConcat(string _x, string _y) internal pure returns (string) {
        bytes memory bx = bytes(_x);
        bytes memory by = bytes(_y);
        string memory xy = new string(bx.length + by.length);
        bytes memory bxy = bytes(xy);
        uint k = 0;
        for (uint i = 0; i < bx.length; i++) bxy[k++] = bx[i];
        for (i = 0; i < by.length; i++) bxy[k++] = by[i];
        return string(bxy);
    }
}