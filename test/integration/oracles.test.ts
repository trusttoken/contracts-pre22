import { CONTRACTS_OWNER, forkChain } from './suite'
import { CrvPriceOracle__factory, TruPriceOracle__factory } from 'contracts'
import { parseEth, parseTRU } from 'utils'
import { expect, use } from 'chai'
import { utils } from 'ethers'
import { setupDeploy } from 'scripts/utils'
import { ChainlinkTruUsdcOracle__factory } from 'contracts'
import { solidity } from 'ethereum-waffle'

use(solidity)

describe('Oracles', () => {
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [CONTRACTS_OWNER], 11971336)
  const owner = provider.getSigner(CONTRACTS_OWNER)
  const deployContract = setupDeploy(owner)
  it('TRU oracle', async () => {
    const oracle = await deployContract(TruPriceOracle__factory)
    expect(await oracle.truToUsd(parseTRU(1))).to.equal(parseEth(0.32334))
    expect(await oracle.usdToTru(parseEth(1))).to.equal(parseTRU(3.0927197377))
  })

  it('CRV oracle', async () => {
    const oracle = await deployContract(CrvPriceOracle__factory)
    expect(await oracle.crvToUsd(parseEth(1))).to.equal(parseEth(2.24598504))
    expect(await oracle.usdToCrv(parseEth(1))).to.equal(utils.parseEther('0.445238940683238032'))
  })

  it('USDC-TRU oracle', async () => {
    const oracle = await deployContract(ChainlinkTruUsdcOracle__factory)
    expect(await oracle.truToToken(parseTRU(1))).to.equal(utils.parseUnits('0.32334', 6))
    expect(await oracle.tokenToTru(utils.parseUnits('1', 6))).to.equal(parseTRU(3.0927197377))
    expect(await oracle.tokenToUsd(utils.parseUnits('1', 6))).to.equal(parseEth(1))
  })
})
