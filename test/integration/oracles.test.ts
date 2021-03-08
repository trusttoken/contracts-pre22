import { CONTRACTS_OWNER, forkChain } from './suite'
import { deployContract } from 'scripts/utils/deployContract'
import { CrvPriceOracleFactory, TruPriceOracleFactory } from 'contracts'
import { parseEth, parseTRU } from 'utils'
import { expect } from 'chai'
import { utils } from 'ethers'

describe('Oracles', () => {
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl@11971336', [CONTRACTS_OWNER])
  const owner = provider.getSigner(CONTRACTS_OWNER)

  it('TRU oracle', async () => {
    const oracle = await deployContract(owner, TruPriceOracleFactory)
    expect(await oracle.truToUsd(parseTRU(1))).to.equal(parseEth(0.32334))
    expect(await oracle.usdToTru(parseEth(1))).to.equal(parseTRU(3.0927197377))
  })

  it('CRV oracle', async () => {
    const oracle = await deployContract(owner, CrvPriceOracleFactory)
    expect(await oracle.crvToUsd(parseEth(1))).to.equal(parseEth(2.24598504))
    expect(await oracle.usdToCrv(parseEth(1))).to.equal(utils.parseEther('0.445238940683238032'))
  })
})
