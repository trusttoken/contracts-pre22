certoraRun contracts/truefi2/FixedTermLoan.sol \
  contracts/truefi2/BorrowingMutex.sol \
  contracts/common/UpgradeableERC20.sol:ERC20 \
  --verify FixedTermLoan:spec/truefi2/FixedTermLoan.spec \
  --link FixedTermLoan:token=ERC20 \
  --short_output \
  --optimistic_loop
