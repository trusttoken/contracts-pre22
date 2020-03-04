pragma solidity ^0.5.13;
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";

contract yTrueUSDInterface is IERC20 {
    function deposit(uint256 _amount) external;
    function withdraw(uint256 _shares) external;
    function balanceOf(address account) external view returns (uint256);
    function getPricePerFullShare() public view returns(uint256);
}
