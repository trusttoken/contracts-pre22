pragma solidity ^0.4.18;

import "zeppelin-solidity/contracts/ownership/Claimable.sol";
import "./RegistryAccessManagerImpl.sol";

// based on https://github.com/TPL-protocol/tpl-contracts/blob/master/contracts/Jurisdiction.sol
contract Registry is Claimable {
    struct AttributeData {
        uint256 value;
        address adminAddr;
        uint256 timestamp;
    }

    mapping(address => mapping(string => AttributeData)) private attributes;
    RegistryAccessManager accessManager;

    function Registry() public {
        accessManager = new RegistryAccessManagerImpl();
    }

    event SetAttribute(address indexed who, string attribute, uint256 value, address indexed adminAddr);
    event SetManager(address indexed oldManager, address indexed newManager);

    function setAttribute(address _who, string _attribute, uint256 _value) public {
        require(msg.sender == owner || accessManager.confirmWrite(_who, _attribute, _value, msg.sender));
        attributes[_who][_attribute] = AttributeData(_value, msg.sender, block.timestamp);
        emit SetAttribute(_who, _attribute, _value, msg.sender);
    }

    function hasAttribute(address _who, string _attribute) public view returns (bool) {
        return attributes[_who][_attribute].value != 0;
    }

    function getAttribute(address _who, string _attribute) public view returns (uint256, address, uint256) {
        AttributeData memory data = attributes[_who][_attribute];
        return (data.value, data.adminAddr, data.timestamp);
    }

    function setManager(RegistryAccessManager _accessManager) public onlyOwner {
        emit SetManager(accessManager, _accessManager);
        accessManager = _accessManager;
    }
}