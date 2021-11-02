certoraRun contracts/truefi2/RateModel.sol \
  contracts/truefi2/TrueFiPool2.sol \
  contracts/truefi2/oracles/TimeAveragedTruPriceOracle.sol \
  contracts/common/UpgradeableERC20.sol:ERC20 \
  --verify RateModel:spec/truefi2/RateModel.spec
