import "wjm-airswap-swap/contracts/Swap.sol";
import "wjm-airswap-transfers/contracts/TransferHandlerRegistry.sol";
import "wjm-airswap-transfers/contracts/handlers/ERC20TransferHandler.sol";

pragma solidity 0.5.13;
pragma experimental ABIEncoderV2;


contract Airswap is Swap {}

contract AirswapTransferHandlerRegistry is TransferHandlerRegistry {}

contract AirswapERC20TransferHandler is ERC20TransferHandler {}
