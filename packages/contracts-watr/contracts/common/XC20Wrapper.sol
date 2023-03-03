import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Context} from "@openzeppelin/contracts/GSN/Context.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {ClaimableOwnable} from "./ClaimableOwnable.sol";
import {IMintableXC20} from "../interface/IMintableXC20.sol";

abstract contract XC20Wrapper is IERC20, ClaimableOwnable, Context {

    function _mint(address account, uint256 amount) internal virtual returns (bool) {
        return IMintableXC20(nativeToken).mint(account, amount);
    }

    function decimals() public virtual pure returns (uint8) {
        return IMintableXC20(nativeToken).decimals();
    }

    function totalSupply() public view virtual override returns (uint256) {
        return IMintableXC20(nativeToken).totalSupply();
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return IMintableXC20(nativeToken).allowance(owner, spender);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        return IMintableXC20(nativeToken).approve(spender, amount);
    }

    function balanceOf(address account) external view returns (uint256) {
        return IMintableXC20(nativeToken).balanceOf(account);
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        return IMintableXC20(nativeToken).transfer(recipient, amount);
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        return IMintableXC20(nativeToken).transferFrom(sender, recipient, amount);
    }
}
