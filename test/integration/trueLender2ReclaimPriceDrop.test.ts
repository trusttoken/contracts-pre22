import { CONTRACTS_OWNER, forkChain } from './suite'
import { TrueFiPool2, TrueFiPool2__factory, TrueLender2Deprecated, TrueLender2Deprecated__factory } from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { parseEth } from 'utils'

use(solidity)

describe('TrueLender2.reclaim', () => {
  const TFUSDC_ADDRESS = '0xA991356d261fbaF194463aF6DF8f0464F8f1c742'
  const TRUELENDER2_ADDRESS = '0xa606dd423dF7dFb65Efe14ab66f5fDEBf62FF583'
  const LOAN_ADDRESS = '0x8768f87B31c9B97c35F21b4149eD70E678957B9D'
  const ETH_HOLDER = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  const BLOCK_NUMBER = 14650636 // 2022/04/25
  const PRECISION = 0.0000001

  let trueLender2: TrueLender2Deprecated
  let tfUSDC: TrueFiPool2

  const tfUSDCPrice = async () => {
    return (await tfUSDC.poolValue()).toNumber() / (await tfUSDC.totalSupply()).toNumber()
  }

  beforeEach(async () => {
    const provider = forkChain([CONTRACTS_OWNER, ETH_HOLDER], BLOCK_NUMBER - 1)

    const contractsOwner = provider.getSigner(CONTRACTS_OWNER)
    trueLender2 = TrueLender2Deprecated__factory.connect(TRUELENDER2_ADDRESS, contractsOwner)
    tfUSDC = TrueFiPool2__factory.connect(TFUSDC_ADDRESS, contractsOwner)

    const ethHolder = provider.getSigner(ETH_HOLDER)
    await ethHolder.sendTransaction({ value: parseEth(100), to: CONTRACTS_OWNER })
  })

  it('with nonzero fee causes price drop', async () => {
    expect(await trueLender2.fee()).to.be.gt(0)

    const oldPrice = await tfUSDCPrice()
    await trueLender2.reclaim(LOAN_ADDRESS, '0x')

    expect(await tfUSDCPrice()).to.not.be.closeTo(oldPrice, PRECISION)
    expect(await tfUSDCPrice()).to.be.lt(oldPrice)
  })

  it('with zero fee does not affect price', async () => {
    await trueLender2.setFee(0)

    const oldPrice = await tfUSDCPrice()
    await trueLender2.reclaim(LOAN_ADDRESS, '0x')

    expect(await tfUSDCPrice()).to.be.closeTo(oldPrice, PRECISION)
  })
})
