pragma solidity ^0.5.13;
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract IAToken is IERC20 {
    function redeem(uint256 _shares) external;
}
