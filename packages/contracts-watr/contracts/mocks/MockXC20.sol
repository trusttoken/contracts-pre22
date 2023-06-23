// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

contract MockXC20 {
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    uint8 public decimals;

    mapping(address => bool) public frozen;

    constructor(uint8 _decimals) public {
        decimals = _decimals;
    }

    function mint(address account, uint256 amount) public returns (bool) {
        balanceOf[account] += amount;
        totalSupply += amount;

        return true;
    }

    function burn(address account, uint256 amount) public returns (bool) {
        require(balanceOf[account] >= amount, "XC20: amount exceeds balance");
        balanceOf[account] -= amount;
        totalSupply -= amount;

        return true;
    }

    function freeze(address account) public returns (bool) {
        frozen[account] = true;

        return true;
    }

    function thaw(address account) public returns (bool) {
        frozen[account] = false;

        return true;
    }

    function forceTransfer(address sender, address recipient, uint256 amount) public returns (bool) {
        require(balanceOf[sender] >= amount, "XC20: amount exceeds balance");
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        
        return true;
    }
}
