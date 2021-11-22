// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts4/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts4/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts4/token/ERC721/IERC721Receiver.sol";
import {BulletLoans} from "./BulletLoans.sol";

contract ManagedPortfolio is IERC721Receiver {
    IERC20 underlyingToken;
    BulletLoans bulletLoans;

    event BulletLoanCreated(uint256 id);

    constructor(IERC20 _underlyingToken, BulletLoans _bulletLoans) {
        underlyingToken = _underlyingToken;
        bulletLoans = _bulletLoans;
    }

    function join(uint256 amount) external {
        underlyingToken.transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) external {
        underlyingToken.transfer(msg.sender, amount);
    }

    function createBulletLoan(
        uint256 endDate,
        address borrower,
        uint256 principalAmount,
        uint256 repaymentAmount
    ) public {
        underlyingToken.transfer(borrower, principalAmount);
        uint256 loanId = bulletLoans.createLoan(underlyingToken);
        emit BulletLoanCreated(loanId);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
