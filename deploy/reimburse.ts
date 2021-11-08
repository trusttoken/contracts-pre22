import fs from 'fs'
import { contract, deploy } from 'ethereum-mars'
import { TrustToken } from '../build/artifacts'
import { utils } from 'ethers'

const readCsv = (text: string) => text.split('\n').map(row => row.split(' ') as [string, string]).slice(0, -1)

const reimbursementData = readCsv(fs.readFileSync('./deploy/data/tfTUSDReimbursements.csv').toString())

deploy({}, () => {
  const tru = contract('trustToken_proxy', TrustToken, { skipUpgrade: true })
  for (const [address, amount] of reimbursementData) {
    tru.transfer(address, utils.parseUnits(amount, 8).toNumber())
  }
})
