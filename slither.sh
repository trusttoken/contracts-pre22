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

slither_args="--solc-disable-warnings --exclude-low --exclude-informational --exclude=naming-convention,unused-state-variables,solc-version,assembly-usage,low-level-call"

if ! slither flatten/GovernorAlpha.sol ${slither_args}; then
  echo "slither failed: GovernorAlpha"
  exit 1
fi
if ! slither flatten/Liquidator.sol ${slither_args}; then
  echo "slither failed: Liquidator"
  exit 1
fi
if ! slither flatten/LoanFactory.sol ${slither_args}; then
  echo "slither failed: LoanFactory"
  exit 1
fi
if ! slither flatten/LoanToken.sol ${slither_args}; then
  echo "slither failed: LoanToken"
  exit 1
fi
if ! slither flatten/StkTruToken.sol ${slither_args}; then
  echo "slither failed: StkTruToken"
  exit 1
fi
if ! slither flatten/TrueLender.sol ${slither_args}; then
  echo "slither failed: TrueLender"
  exit 1
fi
if ! slither flatten/TrueRatingAgencyV2.sol ${slither_args}; then
  echo "slither failed: TrueRatingAgencyV2"
  exit 1
fi
if ! slither flatten/TrustToken.sol ${slither_args}; then
  echo "slither failed: TrustToken"
  exit 1
fi
if ! slither flatten/Timelock.sol ${slither_args}; then
  echo "slither failed: Timelock"
  exit 1
fi

echo "Done."
