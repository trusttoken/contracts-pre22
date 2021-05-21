#!/usr/bin/env bash

if [ ! $(which python3) ]; then
  echo "python3 is required to run this script"
  exit 1
fi
if [ ! $(which pip3) ]; then
  echo "pip3 is required to run this script"
  exit 1
fi
if [ ! -d "venv" ]; then
  echo "Generating python virtual environment..."
  python3 -m venv venv
fi

echo "Activating python virtual environment..."
source venv/bin/activate

pip3 install slither-analyzer --disable-pip-version-check
pip3 install solc-select --disable-pip-version-check
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

echo "Deactivating python virtual environment..."
deactivate
echo "Done."
