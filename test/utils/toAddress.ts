import { Wallet } from 'ethers'

export type WalletOrAddress = Wallet | string

export function toAddress (walletOrAddress: WalletOrAddress) {
  return walletOrAddress instanceof Wallet ? walletOrAddress.address : walletOrAddress
}
