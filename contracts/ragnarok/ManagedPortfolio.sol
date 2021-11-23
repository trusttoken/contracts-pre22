// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {IERC20} from "@openzeppelin/contracts4/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts4/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts4/token/ERC721/IERC721.sol";
import {IERC721Receiver} from "@openzeppelin/contracts4/token/ERC721/IERC721Receiver.sol";
import {BulletLoans} from "./BulletLoans.sol";

interface IERC20WithDecimals is IERC20 {
    function decimals() external view returns (uint256);
}

contract ManagedPortfolio is IERC721Receiver, ERC20 {
    IERC20WithDecimals underlyingToken;
    BulletLoans bulletLoans;

    event BulletLoanCreated(uint256 id);

    constructor(IERC20WithDecimals _underlyingToken, BulletLoans _bulletLoans) ERC20("ManagerPortfolio", "MPS") {
        underlyingToken = _underlyingToken;
        bulletLoans = _bulletLoans;
    }

    function join(uint256 amount) external {
        underlyingToken.transferFrom(msg.sender, address(this), amount);
        _mint(msg.sender, (amount * 10**decimals()) / (10**underlyingToken.decimals()));
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
