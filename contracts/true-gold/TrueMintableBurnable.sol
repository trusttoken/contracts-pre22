// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.10;

import "./common/ERC20Burnable.sol";
import "./common/Initializable.sol";
import "./common/Ownable.sol";
import "./common/ProxyStorage.sol";

abstract contract TrueMintableBurnable is ProxyStorage, Initializable, Ownable, ERC20Burnable {
    uint256 constant REDEMPTION_ADDRESS_COUNT = 0x100000;

    event Mint(address indexed to, uint256 value);
    event Burn(address indexed burner, uint256 value);
    event SetBurnBounds(uint256 newMin, uint256 newMax);

    // solhint-disable-next-line func-name-mixedcase
    function __TrueMintableBurnable_init_unchained(uint256 minBurnAmount, uint256 maxBurnAmount) internal initializer {
        setBurnBounds(minBurnAmount, maxBurnAmount);
    }

    function burnMin() public view returns (uint256) {
        return _minBurnAmount;
    }

    function burnMax() public view returns (uint256) {
        return _maxBurnAmount;
    }

    // Change the minimum and maximum amount that can be burned at once. Burning may be disabled by setting both to 0
    // (this will not be done under normal operation, but we can't add checks to disallow it without losing a lot of
    // flexibility since burning could also be as good as disabled by setting the minimum extremely high, and we don't
    // want to lock in any particular cap for the minimum)
    function setBurnBounds(uint256 minAmount, uint256 maxAmount) public virtual onlyOwner {
        require(minAmount <= maxAmount, "TrueMintableBurnable: min is greater then max");
        _minBurnAmount = minAmount;
        _maxBurnAmount = maxAmount;
        emit SetBurnBounds(minAmount, maxAmount);
    }

    function mint(address account, uint256 amount) public virtual onlyOwner {
        require(uint256(account) > REDEMPTION_ADDRESS_COUNT, "TrueMintableBurnable: mint to a redemption or zero address");
        _mint(account, amount);
        emit Mint(account, amount);
    }

    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        require(super.transfer(recipient, amount));
        if (uint256(recipient) <= REDEMPTION_ADDRESS_COUNT) {
            _burn(recipient, amount);
        }
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public virtual override returns (bool) {
        require(super.transferFrom(sender, recipient, amount));
        if (uint256(recipient) <= REDEMPTION_ADDRESS_COUNT) {
            _burn(recipient, amount);
        }
        return true;
    }

    function _burn(address account, uint256 amount) internal virtual override {
        require(amount >= _minBurnAmount, "TrueMintableBurnable: burn amount below min bound");
        require(amount <= _maxBurnAmount, "TrueMintableBurnable: burn amount exceeds max bound");
        super._burn(account, amount);
        emit Burn(account, amount);
    }
}
