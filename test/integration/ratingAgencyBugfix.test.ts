import { CONTRACTS_OWNER, forkChain } from './suite'
import { OwnedUpgradeabilityProxy__factory, TrueRatingAgencyV2, TrueRatingAgencyV2__factory } from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { parseTRU } from 'utils'

use(solidity)

describe('RatingAgency total rewards bug fix', () => {
  const corruptedLoan = '0x4fB2D8104706BEf93EeBEF8dbe549E53aDd5185F'

  const raterAddress = '0xfe3795f64a743d3b9a08f50c4115ec119ac9a9d1'
  const provider = forkChain('https://eth-mainnet.alchemyapi.io/v2/Vc3xNXIWdxEbDOToa69DhWeyhgFVBDWl', [CONTRACTS_OWNER, raterAddress])
  const owner = provider.getSigner(CONTRACTS_OWNER)
  const rater = provider.getSigner(raterAddress)
  const RATING_AGENCY_ADDRESS = '0x05461334340568075be35438b221a3a0d261fb6b'

  let ratingAgency: TrueRatingAgencyV2

  beforeEach(async () => {
    const newImplementation = await new TrueRatingAgencyV2__factory(owner).deploy()
    const proxy = OwnedUpgradeabilityProxy__factory.connect(RATING_AGENCY_ADDRESS, owner)
    await proxy.upgradeTo(newImplementation.address)
    ratingAgency = TrueRatingAgencyV2__factory.connect(RATING_AGENCY_ADDRESS, rater)
  })

  it('total loan rewards update after first claim', async () => {
    const tx = await ratingAgency.claim(corruptedLoan, raterAddress)
    const receipt = await tx.wait()
    expect(receipt.events[4].args.claimedReward).to.be.gt(parseTRU(10))
    expect((await ratingAgency.loans(corruptedLoan)).reward).to.be.gt(parseTRU(10000))
  })

  it('rewards should not update after following claims', async () => {
    await ratingAgency.claim(corruptedLoan, raterAddress)
    const reward = (await ratingAgency.loans(corruptedLoan)).reward
    await ratingAgency.claim(corruptedLoan, raterAddress)
    const receipt = await (await ratingAgency.claim(corruptedLoan, raterAddress)).wait()
    expect(receipt.events.length).to.equal(0)
    expect((await ratingAgency.loans(corruptedLoan)).reward).to.equal(reward)
  })
})
