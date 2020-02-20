pragma solidity ^0.5.13;

contract IdGenerator {
  uint256 nextId;

  function getNextId() internal returns(uint256) {
    return nextId++;
  }
}
