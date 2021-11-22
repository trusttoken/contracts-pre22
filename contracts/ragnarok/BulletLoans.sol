// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import {ERC721} from "@openzeppelin/contracts4/token/ERC721/ERC721.sol";

contract BulletLoans is ERC721 {
    uint256 nextId;

    constructor() ERC721("BulletLoans", "BulletLoans") {}

    function mintLoan() public returns (uint256 loanId) {
        loanId = nextId;
        _safeMint(msg.sender, loanId);
        nextId++;
    }
}
