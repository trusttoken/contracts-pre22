import { BigNumberish, Wallet } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { expect, use } from 'chai'

import { loadFixture, MAX_BURN_BOUND } from 'utils'

import {
  TrueGold,
  TrueGold__factory,
} from 'contracts'

use(solidity)

describe('TrueGold - Initializable', () => {
  let proxy: Wallet
  let token: TrueGold

  async function fixture ([deployer, proxy]: Wallet[]) {
    const trueGoldFactory = new TrueGold__factory(deployer)
    const token = await trueGoldFactory.deploy()

    return { proxy, token }
  }

  beforeEach(async () => {
    ({ proxy, token } = await loadFixture(fixture))
  })

  function initialize (caller: Wallet, minBurnAmount = 12_441_000, maxBurnAmount: BigNumberish = MAX_BURN_BOUND) {
    return token.connect(caller).initialize(minBurnAmount, maxBurnAmount)
  }

  describe('initialize', () => {
    it('can be called by other address than contract deployer', async () => {
      await expect(initialize(proxy)).not.to.be.reverted
    })

    it('cannot be called twice', async () => {
      await initialize(proxy)
      await expect(initialize(proxy)).to.be.revertedWith('Contract instance has already been initialized')
    })

    it('makes the caller the owner of the contract', async () => {
      await initialize(proxy)
      expect(await token.owner()).to.eq(proxy.address)
    })

    it('sets burn bounds', async () => {
      await initialize(proxy)
      expect(await token.burnMin()).to.eq(12_441_000)
      expect(await token.burnMax()).to.eq(MAX_BURN_BOUND)
    })

    it('validates burn bounds values', async () => {
      await expect(initialize(proxy, 8_000_000, MAX_BURN_BOUND))
        .to.be.revertedWith('TrueGold: min amount is not a multiple of 12,441,000')
      await expect(initialize(proxy, 0, 8_000_000))
        .to.be.revertedWith('TrueGold: max amount is not a multiple of 12,441,000')
      await expect(initialize(proxy, 12_441_000 * 2, 12_441_000))
        .to.be.revertedWith('TrueMintableBurnable: min is greater then max')
    })
  })
})
