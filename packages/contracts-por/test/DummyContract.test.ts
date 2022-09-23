import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { setupFixtureLoader } from './setup'
import { dummyContractFixture } from 'fixtures/dummyContractFixture'

use(solidity)

describe('DummyContract', () => {
  const loadFixture = setupFixtureLoader()

  it('should have a constructor', async () => {
    const { dummyContract } = await loadFixture(dummyContractFixture)
    expect(await dummyContract.getValue()).to.eq(5)
  })
})
