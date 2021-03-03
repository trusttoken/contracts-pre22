import { expect, use } from 'chai'
import { beforeEachWithFixture, parseEth, parseTRU } from 'utils'
import { deployMockContract, solidity } from 'ethereum-waffle'
import { IChainLinkJson, TruPriceChainLinkOracle, TruPriceChainLinkOracleFactory } from 'contracts'

use(solidity)

describe('TruPriceChainLinkOracle', () => {
  let oracle: TruPriceChainLinkOracle
  beforeEachWithFixture(async ([wallet]) => {
    const chainlink = await deployMockContract(wallet, IChainLinkJson.abi)
    await chainlink.mock.latestAnswer.returns(parseTRU(0.4)) // 0.4 TRU / USD
    oracle = await new TruPriceChainLinkOracleFactory(wallet).deploy(chainlink.address)
  })

  it('converts price', async () => {
    expect(await oracle.usdToTru(parseEth(10))).to.equal(parseTRU(25))
  })
})
