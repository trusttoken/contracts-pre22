#!/usr/bin/env bash
pip3 install slither-analyzer
pip3 install solc-select
solc-select install 0.6.10
solc-select use 0.6.10

yarn flatten

slither flatten/GovernorAlpha.sol --print human-summary
slither flatten/Liquidator.sol --print human-summary
slither flatten/LoanFactory.sol --print human-summary
slither flatten/LoanToken.sol --print human-summary
slither flatten/StkTruToken.sol --print human-summary
slither flatten/TrueLender.sol --print human-summary
slither flatten/TrueRatingAgencyV2.sol --print human-summary
slither flatten/TrustToken.sol --print human-summary
slither flatten/TimeLock.sol --print human-summary