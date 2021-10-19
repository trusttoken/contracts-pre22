#!/usr/bin/env bash

CONTRACTS=(
  'GovernorAlpha'
  'LoanFactory2'
  'LoanToken2'
  'StkTruToken'
  'TrueRatingAgencyV2'
  'TrustToken'
  'Timelock'
  'CreditModel'
  'TrueMultiFarm'
  'TrueFiPool2'
  'TrueFiCreditOracle'
  'LineOfCreditAgency'
  'TimeAveragedBaseRateOracle'
  'SpotBaseRateOracle'
  'SAFU'
  'PoolFactory'
  'Liquidator2'
  'DeficiencyToken'
  'BorrowingMutex'
  'CurveYearnStrategy'
  'ChainlinkTruOracle'
  'ChainlinkTruTusdOracle'
)

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
for f in "${CONTRACTS[@]}"
do
  # Replace all ABIEncoderV2 lines with a single one on the 1st line
  if grep -q "pragma experimental ABIEncoderV2;" "flatten/$f.sol"; then
    sed -i -e 's/pragma experimental ABIEncoderV2;//g' "flatten/$f.sol"
    echo -e 'pragma experimental ABIEncoderV2;\n' | cat - "flatten/$f.sol" > temp && mv temp "flatten/$f.sol"
  fi
  slither flatten/$f.sol || status=1
done

exit $status
