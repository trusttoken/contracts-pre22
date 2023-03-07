// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Context} from "@openzeppelin/contracts/GSN/Context.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

import {ClaimableOwnable} from "./ClaimableOwnable.sol";
import {IERC20Plus} from "../interface/IERC20Plus.sol";

abstract contract XC20Wrapper is IERC20, ClaimableOwnable, Context {
    using SafeMath for uint256;

    function _mint(address account, uint256 amount) internal virtual {
        IERC20Plus(nativeToken).mint(account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        IERC20Plus(nativeToken).burn(account, amount);
    }

    function decimals() public virtual view returns (uint8) {
        return IERC20Plus(nativeToken).decimals();
    }

    function totalSupply() public view virtual override returns (uint256) {
        return IERC20Plus(nativeToken).totalSupply();
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _approve(address owner, address spender, uint256 amount) internal virtual {
        allowances[owner][spender] = amount;
    }

    function balanceOf(address account) external view override returns (uint256) {
        return IERC20Plus(nativeToken).balanceOf(account);
    }

    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        uint256 _amount = _getTransferAmount(msg.sender, recipient, amount);
        _forceTransfer(msg.sender, recipient, _amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external override returns (bool) {
        uint256 _amount = _getTransferAmount(sender, recipient, amount);
        allowances[sender][recipient] = allowances[sender][recipient].sub(_amount, "XC20: amount exceeds allowance");
        _forceTransfer(sender, recipient, _amount);
        return true;
    }

    function _forceTransfer(address sender, address recipient, uint256 amount) internal {
        require(IERC20Plus(nativeToken).balanceOf(sender) >= amount, "XC20: amount exceeds balance");
        IERC20Plus(nativeToken).burn(sender, amount);
        IERC20Plus(nativeToken).mint(recipient, amount);
    }

    function _getTransferAmount(address /*sender*/, address /*recipient*/, uint256 amount) internal virtual returns (uint256) {
        return amount;
    }

    function name() public virtual pure returns (string memory) {
        return "";
    }

    function symbol() public virtual pure returns (string memory) {
        return "";
    }
}
