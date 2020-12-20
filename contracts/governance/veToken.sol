// SPDX-License-Identifier: MIT 
pragma solidity ^0.6.10;

import {VoteToken} from "./VoteToken.sol";
import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";


contract VeToken is VoteToken {
    mapping(address => bool) public whitelist;

    using SafeMath for uint256;

    function initialize() public {
        require(!initalized, "already initialized");
        owner_ = msg.sender;
        initalized = true;
    }

    function mint(address _to, uint256 _amount) external onlyWhiteList{
        
        _mint(_to, _amount);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function decimals() public override pure returns (uint8) {
        return 8;
    }

    function rounding() public pure returns (uint8) {
        return 8;
    }

    function name() public override pure returns (string memory) {
        return "VeToken";
    }

    function symbol() public override pure returns (string memory) {
        return "VTRU";
    }

    function addWhitelist(address _address) public onlyOwner {
        whitelist[_address] = true;
    }
    
    function removeWhitelist(address _address) public onlyOwner {
        whitelist[_address] = false;
    }

    modifier onlyWhiteList {
        require(whitelist[msg.sender] == true,
        "Only whitelist addresses can call this function."
        );
        _;
    }
}