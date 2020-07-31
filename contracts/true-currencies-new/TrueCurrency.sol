// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import {BurnableTokenWithBounds} from "./BurnableTokenWithBounds.sol";

abstract contract TrueCurrency is BurnableTokenWithBounds {
    uint256 constant CENT = 10**16;
    uint256 constant REDEMPTION_ADDRESS_COUNT = 0x100000;

    /**
     * @dev Emitted when `value` tokens are minted for `to`
     */
    event Mint(address indexed to, uint256 value);

    /**
     * @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Mint} event
     *
     * Requirements
     *
     * - `account` cannot be the zero address.
     * - `account` cannot be blacklisted.
     * - `account` cannot be a redemption address.
     */
    function mint(address account, uint256 amount) external onlyOwner {
        require(!isBlacklisted[account], "TrueCurrency: account is blacklisted");
        require(!isRedemptionAddress(account), "TrueCurrency: account is a redemption address");
        _mint(account, amount);
        emit Mint(account, amount);
    }

    /**
     * @dev Set blacklisted status for the account.
     *
     * Requirements:
     *
     * - `msg.sender` should be owner.
     */
    function setBlacklisted(address account, bool _isBlacklisted) external onlyOwner {
        isBlacklisted[account] = _isBlacklisted;
    }

    /**
     * @dev Set canBurn status for the account.
     *
     * Requirements:
     *
     * - `msg.sender` should be owner.
     */
    function setCanBurn(address account, bool _canBurn) external onlyOwner {
        canBurn[account] = _canBurn;
    }

    /**
     * @dev Check if neither account is blacklisted before performing transfer
     * If transfer recipient is a redemption address, burns tokens
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal override {
        require(!isBlacklisted[sender], "TrueCurrency: sender is blacklisted");
        require(!isBlacklisted[recipient], "TrueCurrency: recipient is blacklisted");

        super._transfer(sender, recipient, amount);

        if (isRedemptionAddress(recipient)) {
            _burn(recipient, amount - (amount % CENT));
        }
    }

    /**
     * @dev Requere neither accounts to be blacklisted before approval
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal override {
        require(!isBlacklisted[owner], "TrueCurrency: tokens owner is blacklisted");
        require(!isBlacklisted[spender], "TrueCurrency: tokens spender is blacklisted");

        super._approve(owner, spender, amount);
    }

    /**
     * @dev Check if tokens can be burnt at address before burning
     */
    function _burn(address account, uint256 amount) internal override {
        require(canBurn[account], "TrueCurrency: cannot burn from this address");
        super._burn(account, amount);
    }

    /**
     * @dev First 0x100000 addresses (0x0000000000000000000000000000000000000000 to 0x00000000000000000000000000000000000fffff)
     * are the redemption addresses.
     *
     * All transfers to redemption address will trigger token burn.
     *
     * @notice For transfer to succeed, canBurn must be true for redemption address
     *
     * @return is `account` a redemption address
     */
    function isRedemptionAddress(address account) internal pure returns (bool) {
        return uint256(account) < REDEMPTION_ADDRESS_COUNT;
    }
}
