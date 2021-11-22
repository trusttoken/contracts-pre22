// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import {ERC721} from "@openzeppelin/contracts4/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts4/token/ERC20/IERC20.sol";

contract BulletLoans is ERC721 {
    uint256 nextId;
    IERC20 underlyingToken;

    constructor() ERC721("BulletLoans", "BulletLoans") {}

    function createLoan(IERC20 _underlyingToken) public returns (uint256 loanId) {
        underlyingToken = _underlyingToken;
        loanId = nextId;
        _safeMint(msg.sender, loanId);
        nextId++;
    }

    function repay(uint256 instrumentId, uint256 amount) public {
        underlyingToken.transferFrom(msg.sender, ownerOf(instrumentId), amount);
    }
}
