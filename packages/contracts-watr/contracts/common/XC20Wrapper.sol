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
        require(account != address(0), "XC20: mint to the zero address");
        IERC20Plus(nativeToken).mint(account, amount);
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal virtual {
        IERC20Plus(nativeToken).burn(account, amount);
        emit Transfer(account, address(0), amount);
    }

    function decimals() public view virtual returns (uint8) {
        return IERC20Plus(nativeToken).decimals();
    }

    function totalSupply() public view virtual override returns (uint256) {
        return IERC20Plus(nativeToken).totalSupply();
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external virtual override returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal virtual {
        require(owner != address(0) && spender != address(0), "XC20: approve to the zero address");
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function decreaseAllowance(address spender, uint256 amount) external virtual {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].sub(amount, "XC20: decreased allowance below zero"));
    }

    function increaseAllowance(address spender, uint256 amount) external virtual {
        _approve(msg.sender, spender, _allowances[msg.sender][spender].add(amount));
    }

    function balanceOf(address account) external view override returns (uint256) {
        return IERC20Plus(nativeToken).balanceOf(account);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual {
        require(recipient != address(0), "XC20: transfer to the zero address");
        _forceTransfer(sender, recipient, amount);
        emit Transfer(sender, recipient, amount);
    }

    function transfer(address recipient, uint256 amount) external virtual override returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external override returns (bool) {
        require(sender != address(0), "XC20: transfer from the zero address");
        _approve(sender, msg.sender, _allowances[sender][msg.sender].sub(amount, "XC20: amount exceeds allowance"));
        _transfer(sender, recipient, amount);
        return true;
    }

    function _forceTransfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        require(IERC20Plus(nativeToken).balanceOf(sender) >= amount, "XC20: amount exceeds balance");
        IERC20Plus(nativeToken).burn(sender, amount);
        IERC20Plus(nativeToken).mint(recipient, amount);
    }

    function name() public pure virtual returns (string memory) {
        return "";
    }

    function symbol() public pure virtual returns (string memory) {
        return "";
    }
}
