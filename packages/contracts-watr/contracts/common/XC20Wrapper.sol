import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Context} from "@openzeppelin/contracts/GSN/Context.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {ClaimableOwnable} from "./ClaimableOwnable.sol";
import {IERC20Plus} from "../interface/IERC20Plus.sol";

abstract contract XC20Wrapper is IERC20, ClaimableOwnable, Context {
    function _mint(address account, uint256 amount) internal virtual {
        IERC20Plus(nativeToken).mint(account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        IERC20Plus(nativeToken).burn(account, amount);
    }

    function decimals() public virtual pure returns (uint8) {
        return IERC20Plus(nativeToken).decimals();
    }

    function totalSupply() public view virtual override returns (uint256) {
        return IERC20Plus(nativeToken).totalSupply();
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return IERC20Plus(nativeToken).allowance(owner, spender);
    }

    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        return _approve(spender, amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual returns (bool) {
        return IERC20Plus(nativeToken).approve(spender, amount);
    }

    function balanceOf(address account) external view override returns (uint256) {
        return IERC20Plus(nativeToken).balanceOf(account);
    }

    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        uint256 _amount = _onTransfer(msg.sender, recipient, amount);
        return IERC20Plus(nativeToken).transfer(recipient, _amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        uint256 _amount = _onTransfer(sender, recipient, amount);
        return IERC20Plus(nativeToken).transferFrom(sender, recipient, _amount);
    }

    function _onTransfer(address sender, address recipient, uint256 amount) internal virtual returns (uint256) {
        return amount;
    }

    function name() public virtual pure returns (string memory) {
        return IERC20Plus(nativeToken).name();
    }

    function symbol() public virtual pure returns (string memory) {
        return IERC20Plus(nativeToken).symbol();
    }
}
