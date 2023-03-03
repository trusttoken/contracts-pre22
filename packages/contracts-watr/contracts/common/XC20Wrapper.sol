import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Context} from "@openzeppelin/contracts/GSN/Context.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {ClaimableOwnable} from "./ClaimableOwnable.sol";
import {IMintableXC20} from "../interface/IMintableXC20.sol";

abstract contract XC20Wrapper is IERC20, ClaimableOwnable, Context {
    using SafeMath for uint256;

    mapping(address => mapping(address => uint256)) allowances;

    function _mint(address account, uint256 amount) internal virtual {
        IMintableXC20(nativeToken).mint(account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        IMintableXC20(nativeToken).burn(account, amount);
    }

    function name() public pure virtual returns (string memory) {
        return "";
    }

    function symbol() public pure virtual returns (string memory) {
        return "";
    }

    function decimals() public virtual view returns (uint8) {
        return IMintableXC20(nativeToken).decimals();
    }

    function totalSupply() public view virtual override returns (uint256) {
        return IMintableXC20(nativeToken).totalSupply();
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return IMintableXC20(nativeToken).allowance(owner, spender);
    }

    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        allowances[owner][spender] = amount;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return IMintableXC20(nativeToken).balanceOf(account);
    }

    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        uint256 _amount = _getTransferAmount(msg.sender, recipient, amount);
        return _forceTransfer(msg.sender, recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        uint256 _amount = _getTransferAmount(sender, recipient, amount);
        _approve(sender, msg.sender, allowances[sender][msg.sender].sub(_amount, "ERC20: Insufficient allowance"));
        return _forceTransfer(sender, recipient, _amount);
    }

    function _forceTransfer(address sender, address recipient, uint256 amount) internal returns (bool) {
        IMintableXC20(nativeToken).burn(sender, amount);
        IMintableXC20(nativeToken).mint(recipient, amount);
        return true;
    }

    function _getTransferAmount(address sender, address /*recipient*/, uint256 amount) internal virtual returns (uint256) {
        return amount;
    }
}
