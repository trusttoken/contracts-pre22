import { formatBytes32String } from '@ethersproject/strings'

const attribute = (name: string) => ({
  name,
  hex: formatBytes32String(name),
})

export const RegistryAttributes = {
  isDepositAddress: attribute('isDepositAddress'),
  isBlacklisted: attribute('isBlacklisted'),
  isTUSDMintPausers: attribute('isTUSDMintPausers'),
  isTUSDMintRatifier: attribute('isTUSDMintRatifier'),
  isTUSDRedemptionAdmin: attribute('isTUSDRedemptionAdmin'),
  isRegisteredContract: attribute('isRegisteredContract'),
  isTrueRewardsWhitelisted: attribute('isTrueRewardsWhitelisted'),
  canBurn: attribute('canBurn'),
  hasPassedKYC: attribute('hasPassedKYC'),
  hasPassedKYCAML: attribute('hasPassedKYC/AML'),
  canSetFutureRefundMinGasPrice: attribute('canSetFutureRefundMinGasPrice'),
  canBurnGBP: attribute('canBurnGBP'),
  canBurnAUD: attribute('canBurnAUD'),
  canBurnCAD: attribute('canBurnCAD'),
  canBurnEUR: attribute('canBurnEUR'),
  canBurnHKD: attribute('canBurnHKD'),
  approvedBeneficiary: attribute('approvedBeneficiary'),
}

export type Attribute = ReturnType<typeof attribute>
