// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;
import {ERC721} from "@openzeppelin/contracts4/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts4/token/ERC20/IERC20.sol";

enum LoanStatus {
    Active,
    Defaulted
}

uint256 constant GRACE_PERIOD = 1 days;

contract BulletLoans is ERC721 {
    uint256 nextId;
    IERC20 underlyingToken;

    constructor() ERC721("BulletLoans", "BulletLoans") {}

    function createLoan(IERC20 _underlyingToken) public returns (uint256) {
        underlyingToken = _underlyingToken;
        uint256 loanId = nextId++;
        _safeMint(msg.sender, loanId);
        return loanId;
    }

    function repay(uint256 instrumentId, uint256 amount) public {
        underlyingToken.transferFrom(msg.sender, ownerOf(instrumentId), amount);
    }
}
