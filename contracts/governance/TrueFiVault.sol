// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {GovernorAlpha} from "./GovernorAlpha.sol";
import {StkTruToken} from "./StkTruToken.sol";
import {ITrueRatingAgencyV2} from "../truefi/interface/ITrueRatingAgencyV2.sol";

/**
 * @title TrueFiVault
 * @dev Vault for granting TRU tokens from owner to beneficiary after a lockout period.
 *
 * After the lockout period, beneficiary may withdraw any TRU in the vault.
 * During the lockout period, the vault still allows beneficiary to stake TRU
 * and cast votes in governance.
 *
 * In case of emergency or error, owner reserves the ability to withdraw all
 * funds in vault.
 */
contract TrueFiVault {
    using SafeMath for uint256;

    address owner;
    address beneficiary;
    uint256 expiry;

    IERC20 tru;
    StkTruToken stkTru;
    GovernorAlpha governance;
    ITrueRatingAgencyV2 ratingAgency;

    uint256 constant LOCKOUT = 180 days;

    event WithdrawTo(address recipient);

    constructor(
        address _beneficiary,
        uint256 _amount,
        GovernorAlpha _governance,
        ITrueRatingAgencyV2 _ratingAgency
    ) public {
        owner = msg.sender;
        beneficiary = _beneficiary;
        expiry = block.timestamp.add(LOCKOUT);

        governance = _governance;
        tru = IERC20(address(governance.trustToken()));
        stkTru = StkTruToken(address(governance.stkTRU()));
        ratingAgency = _ratingAgency;

        require(tru.transferFrom(owner, address(this), _amount), "TrueFiVault: insufficient balance.");
    }

    /**
     * @dev Throws if called by any account other than the beneficiary.
     */
    modifier onlyBeneficiary() {
        require(msg.sender == beneficiary, "only beneficiary");
        _;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    /**
     * @dev Allow owner to withdraw funds in case of emergency or mistake
     */
    function withdrawToOwner() public onlyOwner {
        _withdrawTo(owner);
    }

    /**
     * @dev Withdraw funds to beneficiary after expiry time
     */
    function withdrawToBeneficiary() public onlyBeneficiary {
        require(block.timestamp >= expiry, "TrueFiVault: beneficiary cannot withdraw before expiration");
        _withdrawTo(beneficiary);
    }

    /**
     * @dev Internal function to withdraw funds to recipient
     */
    function _withdrawTo(address recipient) private {
        emit WithdrawTo(recipient);
        require(tru.transfer(recipient, tru.balanceOf(address(this))), "TrueFiVault: insufficient balance.");
        require(stkTru.transfer(recipient, stkTru.balanceOf(address(this))), "TrueFiVault: insufficient balance.");
    }

    /**
     * @dev Cast vote in governance for `proposalId`
     * Uses both TRU and stkTRU balance
     * @param proposalId Proposal ID
     * @param support Vote boolean
     */
    function castVote(uint256 proposalId, bool support) public onlyBeneficiary {
        governance.castVote(proposalId, support);
    }

    /**
     * @dev Rate YES on a loan by staking TRU
     * @param id Loan ID
     */
    function rateLoanYes(address id) public onlyBeneficiary {
        ratingAgency.yes(id);
    }

    /**
     * @dev Rate NO on a loan by staking TRU
     * @param id Loan ID
     */
    function rateLoanNo(address id) public onlyBeneficiary {
        ratingAgency.no(id);
    }

    /**
     * @dev Stake `amount` TRU in staking contract
     * @param amount Amount of TRU to stake
     */
    function stake(uint256 amount) public onlyBeneficiary {
        stkTru.stake(amount);
    }

    /**
     * @dev unstake `amount` TRU in staking contract
     * @param amount Amount of TRU to unstake
     */
    function unstake(uint256 amount) public onlyBeneficiary {
        stkTru.unstake(amount);
    }

    /**
     * @dev Initiate cooldown for staked TRU
     */
    function cooldown() public onlyBeneficiary {
        stkTru.cooldown();
    }

    /**
     * @dev Claim TRU rewards from staking contract
     */
    function claimRewards() public onlyBeneficiary {
        stkTru.claimRewards(tru);
    }

    /**
     * @dev Claim TRU rewards, then restake without transferring
     * Allows account to save more gas by avoiding out-and-back transfers
     */
    function claimRestake() public onlyBeneficiary {
        stkTru.claimRestake();
    }
}
