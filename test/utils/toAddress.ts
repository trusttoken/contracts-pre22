import { Wallet } from 'ethers'

export type WalletOrAddress = Wallet | string

export function toAddress (walletOrAddress: WalletOrAddress) {
  return typeof walletOrAddress === 'string' ? walletOrAddress : walletOrAddress.address
}
