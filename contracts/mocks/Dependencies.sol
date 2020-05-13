pragma solidity 0.5.13;

pragma experimental ABIEncoderV2;

import "wjm-airswap-swap/contracts/Swap.sol";
import "wjm-airswap-transfers/contracts/TransferHandlerRegistry.sol";
import "wjm-airswap-transfers/contracts/handlers/ERC20TransferHandler.sol";
import "@trusttoken/trusttokens/contracts/StakedToken.sol";
import "@trusttoken/trusttokens/contracts/StakingOpportunityFactory.sol";
import "@trusttoken/trusttokens/contracts/Liquidator.sol";
import "@trusttoken/trusttokens/contracts/mocks/MockTrustToken.sol";
import "@trusttoken/trusttokens/contracts/mocks/MultisigLiquidatorMock.sol";
