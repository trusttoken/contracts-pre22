pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoRToken} from "../interface/IPoRToken.sol";

interface ITrueCurrency is IPoRToken {
    function mint(address account, uint256 amount) external;

    function setCanBurn(address account, bool _canBurn) external;

    function setBurnBounds(uint256 _min, uint256 _max) external;

    function refundGas(uint256 amount) external;

    function reclaimEther(address payable _to) external;

    function reclaimToken(IERC20 token, address _to) external;
}
