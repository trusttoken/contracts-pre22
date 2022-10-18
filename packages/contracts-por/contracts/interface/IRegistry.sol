pragma solidity 0.6.10;

interface IRegistry {
    function hasAttribute(address _who, bytes32 _attribute) external view returns (bool);
}
