import { TestTimeAverageTruPriceOracle__factory, TestTimeAverageTruPriceOracle } from 'contracts'
import { deployMockContract, MockContract, MockProvider } from 'ethereum-waffle'
import { beforeEachWithFixture, DAY, parseEth, parseTRU, timeTravel } from 'utils'
import { AggregatorV3InterfaceJson } from 'build'
import { expect } from 'chai'
import { Zero } from '@ethersproject/constants'

const shabo = parseEth(1).div(1e6).toNumber()

describe('TimeAverageTruPriceOracle', () => {
  let oracle: TestTimeAverageTruPriceOracle
  let aggregator: MockContract
  let provider: MockProvider

  beforeEachWithFixture(async ([owner], _provider) => {
    provider = _provider
    aggregator = await deployMockContract(owner, AggregatorV3InterfaceJson.abi)
    oracle = await new TestTimeAverageTruPriceOracle__factory(owner).deploy(aggregator.address)
  })

  async function setTruPrice (price: number) {
    await aggregator.mock.latestRoundData.returns(0, parseTRU(price), 0, 0, 0)
  }

  it('returns current price if buffer is not filled', async () => {
    await setTruPrice(0.5)
    expect(await oracle.truToUsd(parseTRU(1))).to.equal(parseEth(0.5))
    expect(await oracle.truToUsd(parseTRU(10))).to.equal(parseEth(5))
  })

  it('poke correctly updates state in trivial case', async () => {
    await setTruPrice(0.5)
    expect(await oracle.leftIndex()).to.equal(0)
    expect(await oracle.rightIndex()).to.equal(0)

    await oracle.poke()
    expect(await oracle.leftIndex()).to.equal(0)
    expect(await oracle.rightIndex()).to.equal(1)

    await timeTravel(provider, DAY)
    await setTruPrice(0.6)
    await oracle.poke()
    expect(await oracle.leftIndex()).to.equal(0)
    expect(await oracle.rightIndex()).to.equal(2)

    await timeTravel(provider, DAY)
    await setTruPrice(0.7)
    await oracle.poke()
    expect(await oracle.leftIndex()).to.equal(0)
    expect(await oracle.rightIndex()).to.equal(3)

    expect(await oracle.getBufferPrices()).to.deep.equal([Zero, parseTRU(0.5), parseTRU(0.6), parseTRU(0.7), ...Array(251).fill(Zero)])
  })

  it('returns average price in trivial case', async () => {
    await timeTravel(provider, DAY)
    await setTruPrice(0.5)
    await oracle.poke()
    await oracle.truToUsd(parseTRU(1))
    await timeTravel(provider, DAY)
    await setTruPrice(0.6)
    await oracle.poke()
    await oracle.truToUsd(parseTRU(1))
    await timeTravel(provider, DAY)
    await setTruPrice(0.7)
    await oracle.poke()
    await timeTravel(provider, DAY)
    await setTruPrice(0.8)
    expect(await oracle.truToUsd(parseTRU(1))).to.be.closeTo(parseEth(0.65), shabo)
  })

  it('correctly moves pointers out of outdated buffer points', async () => {
    await timeTravel(provider, DAY * 5)
    await setTruPrice(0.5)
    await oracle.poke()
    await timeTravel(provider, DAY * 5)
    await setTruPrice(0.6)
    await oracle.poke()
    await timeTravel(provider, DAY * 5)
    await setTruPrice(0.7)
    await oracle.poke()
    await timeTravel(provider, DAY * 5)
    await setTruPrice(0.8)
    expect(await oracle.leftIndex()).to.equal(1)
    expect(await oracle.rightIndex()).to.equal(3)
    expect(await oracle.truToUsd(parseTRU(1))).to.be.closeTo(parseEth(0.7), shabo)
  })

  it('leaves only one buffer point if lag between updates exceeds 7 days', async () => {
    await setTruPrice(0.5)
    await oracle.poke()
    await timeTravel(provider, DAY * 8)
    await setTruPrice(0.6)
    await oracle.poke()
    expect(await oracle.leftIndex()).to.equal(1)
    expect(await oracle.rightIndex()).to.equal(2)
    expect(await oracle.truToUsd(parseTRU(1))).to.equal(parseEth(0.6))
  })

  it('handles removal of multiple points from running totals', async () => {
    await setTruPrice(0.5)
    await oracle.poke()
    await timeTravel(provider, DAY)
    await setTruPrice(0.6)
    await oracle.poke()
    await timeTravel(provider, DAY)
    await setTruPrice(0.7)
    await oracle.poke()
    await timeTravel(provider, DAY)
    await setTruPrice(0.8)
    await oracle.poke()
    await timeTravel(provider, DAY * 8)
    await setTruPrice(1)
    await oracle.poke()

    expect(await oracle.leftIndex()).to.equal(4)
    expect(await oracle.rightIndex()).to.equal(5)
    expect(await oracle.truToUsd(parseTRU(1))).to.equal(parseEth(1))
  })

  it('buffer goes full cycle', async () => {
    await oracle.testFillBuffer(Array(255).fill(parseTRU(1)))
    await setTruPrice(2)
    await oracle.poke()
    expect(await oracle.leftIndex()).to.equal(0)
    expect(await oracle.rightIndex()).to.equal(0)

    expect(await oracle.getBufferPrices()).to.deep.equal([parseTRU(2), ...Array(254).fill(parseTRU(1))])

    await setTruPrice(3)
    await oracle.poke()
    expect(await oracle.leftIndex()).to.equal(1)
    expect(await oracle.rightIndex()).to.equal(1)

    expect(await oracle.getBufferPrices()).to.deep.equal([parseTRU(2), parseTRU(3), ...Array(253).fill(parseTRU(1))])
  })

  it('both indexes correctly go from buffer end to start', async () => {
    await oracle.testFillBuffer(Array(253).fill(parseTRU(0.5)))
    await timeTravel(provider, DAY * 3)
    await setTruPrice(1)
    await oracle.poke()
    await timeTravel(provider, DAY * 3)
    await setTruPrice(2)
    await oracle.poke()

    expect(await oracle.leftIndex()).to.equal(0)
    expect(await oracle.rightIndex()).to.equal(254)

    await timeTravel(provider, DAY * 3)
    await setTruPrice(3)
    await oracle.poke()

    expect(await oracle.leftIndex()).to.equal(252)
    expect(await oracle.rightIndex()).to.equal(0)

    await timeTravel(provider, DAY * 3)
    await oracle.poke()
    await timeTravel(provider, DAY * 3)
    await oracle.poke()
    await timeTravel(provider, DAY * 3)
    await oracle.poke()

    expect(await oracle.leftIndex()).to.equal(0)
    expect(await oracle.rightIndex()).to.equal(3)

    expect(await oracle.truToUsd(parseTRU(1))).to.equal(parseEth(3))
  })

  it('spamming updates very often should not impact price significantly', async () => {
    await setTruPrice(0.5)
    await oracle.poke()
    await setTruPrice(10)
    await oracle.poke()
    await oracle.poke()
    await oracle.poke()
    await oracle.poke()
    await setTruPrice(0.5)
    await timeTravel(provider, DAY)

    expect(await oracle.truToUsd(parseTRU(1))).to.be.closeTo(parseEth(0.5), parseEth(0.001).toNumber())
  })
})
