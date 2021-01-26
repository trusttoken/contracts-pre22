import { expect } from "chai"
import { Liquidator, LiquidatorFactory, LoanFactory, LoanFactoryFactory, MockErc20Token, MockErc20TokenFactory } from "contracts"
import { MockProvider } from "ethereum-waffle"
import { Wallet } from "ethers"
import { beforeEachWithFixture } from "utils"


describe('Liquidator', () => {
    let provider: MockProvider
    let owner: Wallet
    let liquidator: Liquidator

    let loanFactory: LoanFactory
    let stakingPool: MockErc20Token

    beforeEachWithFixture(async (wallets, _provider) => {
        [owner] = wallets
        provider = _provider

        liquidator = await new LiquidatorFactory(owner).deploy()
        loanFactory = await new LoanFactoryFactory(owner).deploy()
        stakingPool = await new MockErc20TokenFactory(owner).deploy()
        await liquidator.initialize(
            loanFactory.address,
            stakingPool.address,
        )
    })

    describe('Initializer', () => {
        it('factory set correctly', async () => {
            expect(await liquidator._factory()).to.equal(loanFactory.address)
        })

        it('staking pool set correctly', async () => {
            expect(await liquidator._stakingPool()).to.equal(stakingPool.address)
        })
    })
})