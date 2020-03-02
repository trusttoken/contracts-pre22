pragma solidity ^0.5.13;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../yTrueUSDInterface.sol";

contract yTrueUSD is yTrueUSDInterface, ERC20 {
    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
