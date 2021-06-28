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

source venv/bin/activate

pip3 install slither-analyzer --disable-pip-version-check
pip3 install solc-select --disable-pip-version-check

solc-select install 0.6.10
solc-select use 0.6.10

yarn flatten

status=0
slither flatten/GovernorAlpha.sol || status=1
slither flatten/Liquidator.sol || status=1
slither flatten/LoanFactory.sol || status=1
slither flatten/LoanToken.sol || status=1
slither flatten/StkTruToken.sol || status=1
slither flatten/TrueLender.sol || status=1
slither flatten/TrueRatingAgencyV2.sol || status=1
slither flatten/TrustToken.sol || status=1
slither flatten/Timelock.sol || status=1

exit $status
