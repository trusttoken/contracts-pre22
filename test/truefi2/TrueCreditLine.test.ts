import {
  TrueFiPool2,
  TrueCreditLine,
  TrueCreditLine__factory,
} from 'contracts'
import { expect, use } from 'chai'
import { deployContract, solidity } from 'ethereum-waffle'
import { Wallet } from 'ethers'
import { beforeEachWithFixture } from 'utils/beforeEachWithFixture'
import { parseEth, setupTruefi2 } from 'utils'

use(solidity)

describe('TrueCreditLine', () => {
  let owner: Wallet
  let pool: TrueFiPool2
  let creditLine: TrueCreditLine

  beforeEachWithFixture(async (wallets) => {
    [owner] = wallets

    ;({ standardPool: pool } = await setupTruefi2(owner))
    creditLine = await deployContract(owner, TrueCreditLine__factory, [owner.address, pool.address, parseEth(1000)])
  })

  describe('on creation', () => {
    it('sets borrower', async () => {
      expect(await creditLine.borrower()).to.eq(owner.address)
    })
  
    it('sets pool', async () => {
      expect(await creditLine.pool()).to.eq(pool.address)
    })

    it('sets principal debt', async () => {
      expect(await creditLine.principalDebt()).to.eq(parseEth(1000))
    })
  
    it('mints tokens to the pool', async () => {
      expect(await creditLine.balanceOf(pool.address)).to.eq(parseEth(1000))
    })
  
    it('returns correct version', async () => {
      expect(await creditLine.version()).to.eq(0)
    })
  })
})
