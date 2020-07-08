// SPDX-License-Identifier: MIT
pragma solidity 0.6.10;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./ValSafeMath.sol";
import "./ILiquidator.sol";
import "./Registry/Registry.sol";

/**
 * @dev Uniswap
 * This is nessesary since Uniswap is written in vyper.
 */
interface UniswapV1 {
    function tokenToExchangeSwapInput(
        uint256 tokensSold,
        uint256 minTokensBought,
        uint256 minEthBought,
        uint256 deadline,
        UniswapV1 exchangeAddress
    ) external returns (uint256 tokensBought);

    function tokenToExchangeTransferInput(
        uint256 tokensSold,
        uint256 minTokensBought,
        uint256 minEthBought,
        uint256 deadline,
        address recipient,
        UniswapV1 exchangeAddress
    ) external returns (uint256 tokensBought);

    function tokenToExchangeSwapOutput(
        uint256 tokensBought,
        uint256 maxTokensSold,
        uint256 maxEthSold,
        uint256 deadline,
        UniswapV1 exchangeAddress
    ) external returns (uint256 tokensSold);

    function tokenToExchangeTransferOutput(
        uint256 tokensBought,
        uint256 maxTokensSold,
        uint256 maxEthSold,
        uint256 deadline,
        address recipient,
        UniswapV1 exchangeAddress
    ) external returns (uint256 tokensSold);
}

/**
 * @dev Uniswap Factory
 * This is nessesary since Uniswap is written in vyper.
 */
interface UniswapV1Factory {
    function getExchange(IERC20 token) external returns (UniswapV1);
}

/**
 * @title Abstract Uniswap Liquidator
 * @dev Liquidate staked tokenns on uniswap.
 * StakingOpportunityFactory does not create a Liquidator, rather this must be created
 * Outside of the factory.
 */
abstract contract ALiquidatorUniswap is ILiquidator {
    using ValSafeMath for uint256;

    // owner, registry attributes
    address public owner;
    address public pendingOwner;
    mapping(address => uint256) attributes;

    // constants
    bytes32 constant APPROVED_BENEFICIARY = "approvedBeneficiary";
    uint256 constant LIQUIDATOR_CAN_RECEIVE = 0xff00000000000000000000000000000000000000000000000000000000000000;
    uint256 constant LIQUIDATOR_CAN_RECEIVE_INV = 0x00ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

    uint256 constant MAX_UINT = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    uint256 constant MAX_UINT128 = 0xffffffffffffffffffffffffffffffff;
    bytes2 constant EIP191_HEADER = 0x1901;

    // internal variables implemented as storage by Liquidator
    // these variables must be known at construction time
    // Liquidator is the actual implementation of ALiquidator

    /** @dev Output token on uniswap. */
    function outputUniswapV1() public virtual view returns (UniswapV1);

    /** @dev Stake token on uniswap. */
    function stakeUniswapV1() public virtual view returns (UniswapV1);

    /** @dev Contract registry. */
    function registry() public virtual view returns (Registry);

    /**
     * @dev implementation constructor needs to call initialize
     * Here we approve transfers to uniswap for the staking and output token
     */
    function initialize() internal {
        outputToken().approve(address(outputUniswapV1()), MAX_UINT);
        stakeToken().approve(address(stakeUniswapV1()), MAX_UINT);
    }

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Liquidated(uint256 indexed stakeAmount, uint256 indexed debtAmount);

    modifier onlyRegistry {
        require(msg.sender == address(registry()), "only registry");
        _;
    }

    modifier onlyPendingOwner() {
        require(msg.sender == pendingOwner, "only pending owner");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        pendingOwner = newOwner;
    }

    function claimOwnership() public onlyPendingOwner {
        emit OwnershipTransferred(owner, pendingOwner);
        owner = pendingOwner;
        pendingOwner = address(0);
    }

    /**
     * @dev Two flags are supported by this function:
     * Supports APPROVED_BENEFICIARY
     * Can sync by saying this contract is the registry or sync from registry directly.
     */
    function syncAttributeValue(
        address _account,
        bytes32 _attribute,
        uint256 _value
    ) external onlyRegistry {
        if (_attribute == APPROVED_BENEFICIARY) {
            // approved beneficiary flag defines whether someone can receive
            if (_value > 0) {
                attributes[_account] |= LIQUIDATOR_CAN_RECEIVE;
            } else {
                attributes[_account] &= LIQUIDATOR_CAN_RECEIVE_INV;
            }
        }
    }

    struct UniswapState {
        UniswapV1 uniswap;
        uint256 etherBalance;
        uint256 tokenBalance;
    }

    /**
     * @dev Calculate how much output we get for a stake input amount
     * Much cheaper to do this logic ourselves locally than an external call
     * Allows us to do this multiple times in one transaction
     * See ./uniswap/uniswap_exchange.vy
     */
    function outputForUniswapV1Input(
        uint256 stakeInputAmount,
        UniswapState memory outputUniswapV1State,
        UniswapState memory stakeUniswapV1State
    ) internal pure returns (uint256 outputAmount) {
        uint256 inputAmountWithFee = 997 * stakeInputAmount;
        inputAmountWithFee =
            (997 * (inputAmountWithFee * stakeUniswapV1State.etherBalance)) /
            (stakeUniswapV1State.tokenBalance * 1000 + inputAmountWithFee);
        outputAmount =
            (inputAmountWithFee * outputUniswapV1State.tokenBalance) /
            (outputUniswapV1State.etherBalance * 1000 + inputAmountWithFee);
    }

    /**
     * @dev Calcualte how much input we need to get a desired output
     * Is able to let us know if there is slippage in uniswap exchange rate
     * See./uniswap/uniswap_exchange.vy
     */
    function inputForUniswapV1Output(
        uint256 outputAmount,
        UniswapState memory outputUniswapV1State,
        UniswapState memory stakeUniswapV1State
    ) internal pure returns (uint256 inputAmount) {
        if (outputAmount >= outputUniswapV1State.tokenBalance) {
            return MAX_UINT128;
        }
        uint256 ethNeeded = (outputUniswapV1State.etherBalance * outputAmount * 1000) /
            (997 * (outputUniswapV1State.tokenBalance - outputAmount)) +
            1;
        if (ethNeeded >= stakeUniswapV1State.etherBalance) {
            return MAX_UINT128;
        }
        inputAmount =
            (stakeUniswapV1State.tokenBalance * ethNeeded * 1000) /
            (997 * (stakeUniswapV1State.etherBalance - ethNeeded)) +
            1;
    }

    /**
     * @dev Transfer stake without liquidation
     * requires LIQUIDATOR_CAN_RECEIVE flag (recipient must be registered)
     */
    function reclaimStake(address _destination, uint256 _stake) external override onlyOwner {
        require(attributes[_destination] & LIQUIDATOR_CAN_RECEIVE != 0, "unregistered recipient");
        stakeToken().transferFrom(pool(), _destination, _stake);
    }

    /**
     * @dev Award stake tokens to stakers.
     * Transfer to the pool without creating a staking position.
     * Allows us to reward as staking or reward token.
     */
    function returnStake(address _from, uint256 balance) external override {
        stakeToken().transferFrom(_from, pool(), balance);
    }

    /**
     * @dev Sells stake for underlying asset and pays to destination.
     * Contract won't slip Uniswap this way.
     * If we reclaim more than we actually owe we award to stakers.
     * Not possible to convert back into TrustTokens here.
     */
    function reclaim(address _destination, int256 _debt) external override onlyOwner {
        require(_debt > 0, "Must reclaim positive amount");
        require(_debt < int256(MAX_UINT128), "reclaim amount too large");
        require(attributes[_destination] & LIQUIDATOR_CAN_RECEIVE != 0, "unregistered recipient");

        // get balance of stake pool
        address stakePool = pool();
        uint256 remainingStake = stakeToken().balanceOf(stakePool);

        // withdraw to liquidator
        require(
            stakeToken().transferFrom(stakePool, address(this), remainingStake),
            "liquidator not approved to transferFrom stakeToken"
        );

        // load uniswap state for output and staked token
        UniswapState memory outputUniswapV1State;
        UniswapState memory stakeUniswapV1State;
        outputUniswapV1State.uniswap = outputUniswapV1();
        outputUniswapV1State.etherBalance = address(outputUniswapV1State.uniswap).balance;
        outputUniswapV1State.tokenBalance = outputToken().balanceOf(address(outputUniswapV1State.uniswap));
        stakeUniswapV1State.uniswap = stakeUniswapV1();
        stakeUniswapV1State.etherBalance = address(stakeUniswapV1State.uniswap).balance;
        stakeUniswapV1State.tokenBalance = stakeToken().balanceOf(address(stakeUniswapV1State.uniswap));

        // calculate remaining debt
        int256 remainingDebt = _debt;

        // if we have remaining debt and stake, we use Uniswap
        // we can use uniswap by specifying desired output or input
        if (remainingDebt > 0) {
            if (remainingStake > 0) {
                if (outputForUniswapV1Input(remainingStake, outputUniswapV1State, stakeUniswapV1State) < uint256(remainingDebt)) {
                    // liquidate all remaining stake :(
                    uint256 outputAmount = stakeUniswapV1State.uniswap.tokenToExchangeSwapInput(
                        remainingStake,
                        1,
                        1,
                        block.timestamp,
                        outputUniswapV1State.uniswap
                    );
                    emit Liquidated(remainingStake, outputAmount);

                    // update remaining stake and debt
                    remainingDebt -= int256(outputAmount);
                    remainingStake = 0;

                    // send output token to destination
                    outputToken().transfer(_destination, uint256(_debt - remainingDebt));
                } else {
                    // finish liquidation via uniswap
                    uint256 stakeSold = stakeUniswapV1State.uniswap.tokenToExchangeSwapOutput(
                        uint256(remainingDebt),
                        remainingStake,
                        MAX_UINT,
                        block.timestamp,
                        outputUniswapV1State.uniswap
                    );
                    emit Liquidated(stakeSold, uint256(remainingDebt));
                    remainingDebt = 0;
                    remainingStake -= stakeSold;
                    //
                    outputToken().transfer(_destination, uint256(_debt));
                }
            }
        } else {
            // if we end up with a tiny amount of delta, transfer to the pool
            if (remainingDebt < 0) {
                outputToken().transfer(stakePool, uint256(-remainingDebt));
            }

            // transfer output token to destination
            outputToken().transfer(_destination, uint256(_debt));
        }

        // if there is remaining stake, return remainder to pool
        if (remainingStake > 0) {
            stakeToken().transfer(stakePool, remainingStake);
        }
    }
}
