import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'
import { Wallet } from 'ethers'
import { expect } from 'chai'
import { MockProvider } from 'ethereum-waffle'
import { Zero, MaxUint256 } from 'ethers/constants'
import { toTrustToken } from '../../scripts/utils/toTrustToken'
import { TrueDistributor } from '../../build/types/TrueDistributor'
import { TrueDistributorFactory } from '../../build/types/TrueDistributorFactory'

describe('TrueDistributor', () => {
    let owner: Wallet
    let distributor: TrueDistributor
    let startingBlock: number
    let provider: MockProvider

    beforeEachWithFixture(async (_provider, wallets) => {
        [owner] = wallets
        provider = _provider
        startingBlock = await provider.getBlockNumber() + 5
        distributor = await new TrueDistributorFactory(owner).deploy(0)
    })

    describe('reward', () => {
        it('returns 0 for 0 blocks interval', async () => {
            expect(await distributor.reward(0, 0)).to.equal(0)
            expect(await distributor.reward(10, 10)).to.equal(0)
            expect(await distributor.reward(1000, 1000)).to.equal(0)
        })

        it('has correct precision', async () => {
            expect((await distributor.reward(0, await distributor.TOTAL_BLOCKS())).div(await distributor.PRECISION())).to.equal(toTrustToken(536500000).sub(1))
        })

        it('from block 0 to last', async () => {
            expect(await distributor.reward(0, await distributor.TOTAL_BLOCKS())).to.equal('53649999999999999999999999971605309297031160000000')
        })

        it('sums to total TRU distributor (with step 100000)', async () => {
            let sum = Zero
            const totalBlocks = (await distributor.TOTAL_BLOCKS()).toNumber()

            for (let i = 0; i < totalBlocks; i += 100000) {
                const newReward = await distributor.reward(i, Math.min(i + 100000, totalBlocks))
                sum = sum.add(newReward)
            }
            expect(sum).to.equal('53649999999999999999999999971605309297031160000000')
        })

        it('in every following interval reward is smaller (with step 100000)', async () => {
            let lastReward = MaxUint256
            const totalBlocks = (await distributor.TOTAL_BLOCKS()).toNumber()

            for (let i = 0; i < totalBlocks; i += 100000) {
                const newReward = await distributor.reward(i, Math.min(i + 100000, totalBlocks))
                expect(newReward).to.be.lt(lastReward)
                lastReward = newReward
            }
        })

        it('reverts on invalid interval', async () => {
            expect(distributor.reward(10, 1)).to.be.revertedWith('invalid interval')
        })

        it('no reward can be claimed before starting block', async () => {
            const distributorWithPostponedRewards = await new TrueDistributorFactory(owner).deploy(100)
            expect(await distributorWithPostponedRewards.reward(0, 1)).to.equal('0')
        })

        it('returns proper value (staring block is > 0)', async () => {
            const distributorWithPostponedRewards = await new TrueDistributorFactory(owner).deploy(2000)
            const rewardFromPostponedDistributor = await distributorWithPostponedRewards.reward(2000, 2004)
            const rewardFromDefaultDistributor = await distributor.reward(0, 4)

            expect(rewardFromPostponedDistributor).to.equal(rewardFromDefaultDistributor)
        })

        it('returns proper value if interval starts before staring block, but ends after', async () => {
            const distributorWithPostponedRewards = await new TrueDistributorFactory(owner).deploy(2)
            const rewardFromPostponedDistributor = await distributorWithPostponedRewards.reward(0, 4)
            const rewardFromDefaultDistributor = await distributor.reward(0, 2)

            expect(rewardFromPostponedDistributor).to.equal(rewardFromDefaultDistributor)
        })
    })
})
