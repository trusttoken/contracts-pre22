// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {BurnableTokenWithBounds} from "./common/BurnableTokenWithBounds.sol";

/**
 * @title TrueCurrency
 * @dev TrueCurrency is an ERC20 with blacklist & redemption addresses
 *
 * TrueCurrency is a compliant stablecoin with blacklist and redemption
 * addresses. Only the owner can blacklist accounts. Redemption addresses
 * are assigned automatically to the first 0x100000 addresses. Sending
 * tokens to the redemption address will trigger a burn operation. Only
 * the owner can mint or blacklist accounts.
 *
 * This contract is owned by the TokenController, which manages token
 * minting & admin functionality. See TokenController.sol
 *
 * See also: BurnableTokenWithBounds.sol
 *
 * ~~~~ Features ~~~~
 *
 * Redemption Addresses
 * - The first 0x100000 addresses are redemption addresses
 * - Tokens sent to redemption addresses are burned
 * - Redemptions are tracked off-chain
 * - Cannot mint tokens to redemption addresses
 *
 * Blacklist
 * - Owner can blacklist accounts in accordance with local regulatory bodies
 * - Only a court order will merit a blacklist; blacklisting is extremely rare
 *
 * Burn Bounds & CanBurn
 * - Owner can set min & max burn amounts
 * - Only accounts flagged in canBurn are allowed to burn tokens
 * - canBurn prevents tokens from being sent to the incorrect address
 *
 * Reclaimer Token
 * - ERC20 Tokens and Ether sent to this contract can be reclaimed by the owner
 */
abstract contract TrueCurrency is BurnableTokenWithBounds {
    uint256 constant CENT = 10**16;
    uint256 constant REDEMPTION_ADDRESS_COUNT = 0x100000;

    /**
     * @dev Emitted when account blacklist status changes
     */
    event Blacklisted(address indexed account, bool isBlacklisted);

    /**
     * @dev Emitted when `value` tokens are minted for `to`
     * @param to address to mint tokens for
     * @param value amount of tokens to be minted
     */
    event Mint(address indexed to, uint256 value);

    /**
     * @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     * @param account address to mint tokens for
     * @param amount amount of tokens to be minted
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
     * @param account address to set blacklist flag for
     * @param _isBlacklisted blacklist flag value
     *
     * Requirements:
     *
     * - `msg.sender` should be owner.
     */
    function setBlacklisted(address account, bool _isBlacklisted) external onlyOwner {
        require(uint256(account) >= REDEMPTION_ADDRESS_COUNT, "TrueCurrency: blacklisting of redemption address is not allowed");
        isBlacklisted[account] = _isBlacklisted;
        emit Blacklisted(account, _isBlacklisted);
    }

    /**
     * @dev Set canBurn status for the account.
     * @param account address to set canBurn flag for
     * @param _canBurn canBurn flag value
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
     * @notice Transfer to redemption address will burn tokens with a 1 cent precision
     * @param sender address of sender
     * @param recipient address of recipient
     * @param amount amount of tokens to transfer
     */
    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        require(!isBlacklisted[sender], "TrueCurrency: sender is blacklisted");
        require(!isBlacklisted[recipient], "TrueCurrency: recipient is blacklisted");

        if (isRedemptionAddress(recipient)) {
            super._transfer(sender, recipient, amount.sub(amount.mod(CENT)));
            _burn(recipient, amount.sub(amount.mod(CENT)));
        } else {
            super._transfer(sender, recipient, amount);
        }
    }

    /**
     * @dev Requere neither accounts to be blacklisted before approval
     * @param owner address of owner giving approval
     * @param spender address of spender to approve for
     * @param amount amount of tokens to approve
     */
    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal override {
        require(!isBlacklisted[owner], "TrueCurrency: tokens owner is blacklisted");
        require(!isBlacklisted[spender] || amount == 0, "TrueCurrency: tokens spender is blacklisted");

        super._approve(owner, spender, amount);
    }

    /**
     * @dev Check if tokens can be burned at address before burning
     * @param account account to burn tokens from
     * @param amount amount of tokens to burn
     */
    function _burn(address account, uint256 amount) internal override {
        require(canBurn[account], "TrueCurrency: cannot burn from this address");
        super._burn(account, amount);
    }

    /**
     * @dev First 0x100000-1 addresses (0x0000000000000000000000000000000000000001 to 0x00000000000000000000000000000000000fffff)
     * are the redemption addresses.
     * @param account address to check is a redemption address
     *
     * All transfers to redemption address will trigger token burn.
     *
     * @notice For transfer to succeed, canBurn must be true for redemption address
     *
     * @return is `account` a redemption address
     */
    function isRedemptionAddress(address account) internal pure returns (bool) {
        return uint256(account) < REDEMPTION_ADDRESS_COUNT && uint256(account) != 0;
    }
}
