// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "./common/Initializable.sol";
import "./common/Ownable.sol";

import "./Reclaimable.sol";
import "./TrueMintableBurnable.sol";

contract TrueGold is Initializable, Ownable, TrueMintableBurnable, Reclaimable {
    using SafeMath for uint256;

    uint8 private constant DECIMALS = 6;
    uint256 private constant BURN_AMOUNT_MULTIPLIER = 12_500_000;

    function initialize(uint256 minBurnAmount, uint256 maxBurnAmount) public initializer {
        __Ownable_init_unchained();
        __TrueMintableBurnable_init_unchained(minBurnAmount, maxBurnAmount);
    }

    function decimals() public override pure returns (uint8) {
        return DECIMALS;
    }

    function name() public override pure returns (string memory) {
        return "TrueGold";
    }

    function symbol() public override pure returns (string memory) {
        return "TGLD";
    }

    function setBurnBounds(uint256 minAmount, uint256 maxAmount) public override onlyOwner {
        require(minAmount.mod(BURN_AMOUNT_MULTIPLIER) == 0, "TrueGold: min amount is not a multiple of 12,500,000");
        require(maxAmount.mod(BURN_AMOUNT_MULTIPLIER) == 0, "TrueGold: max amount is not a multiple of 12,500,000");
        super.setBurnBounds(minAmount, maxAmount);
    }

    function _burn(address account, uint256 amount) internal virtual override {
        require(amount.mod(BURN_AMOUNT_MULTIPLIER) == 0, "TrueGold: burn amount is not a multiple of 12,500,000");
        super._burn(account, amount);
    }
}
