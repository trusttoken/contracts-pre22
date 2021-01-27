import { expect } from "chai"
import { ITrueFiPoolJson, Liquidator, LiquidatorFactory, LoanFactory, LoanFactoryFactory, LoanToken, LoanTokenFactory, MockErc20Token, MockErc20TokenFactory, MockTrueCurrency, MockTrueCurrencyFactory } from "contracts"
import { deployMockContract, MockProvider } from "ethereum-waffle"
import { Contract, Wallet } from "ethers"
import { beforeEachWithFixture, parseEth, timeTravel } from "utils"


describe('Liquidator', () => {
    enum LoanTokenStatus { Awaiting, Funded, Withdrawn, Settled, Defaulted, Liquidated }

    let provider: MockProvider
    let owner: Wallet
    let borrower: Wallet
    let otherWallet: Wallet
    let liquidator: Liquidator

    let tusd: MockTrueCurrency
    let loanToken: LoanToken
    let pool: Contract
    let stakingPool: MockErc20Token

    const dayInSeconds = 60 * 60 * 24
    const yearInSeconds = dayInSeconds * 365
    const averageMonthInSeconds = yearInSeconds / 12
    const defaultedLoanCloseTime = yearInSeconds + dayInSeconds

    const withdraw = async (wallet: Wallet, beneficiary = wallet.address) =>
        loanToken.connect(wallet).withdraw(beneficiary)

    beforeEachWithFixture(async (wallets, _provider) => {
        [owner, borrower, otherWallet] = wallets
        provider = _provider

        liquidator = await new LiquidatorFactory(owner).deploy()
        tusd = await new MockTrueCurrencyFactory(owner).deploy()
        pool = await deployMockContract(owner, ITrueFiPoolJson.abi)
        await tusd.initialize()
        stakingPool = await new MockErc20TokenFactory(owner).deploy()


        await liquidator.initialize(
            pool.address,
            stakingPool.address,
        )

        loanToken = await new LoanTokenFactory(owner).deploy(
            tusd.address,
            borrower.address,
            owner.address,
            parseEth(1000),
            yearInSeconds,
            1000,
          )

        await tusd.mint(owner.address, parseEth(1e7))
        await tusd.approve(loanToken.address, parseEth(1e7))
    })

    describe('Initializer', () => {
        it('trueFiPool set correctly', async () => {
            expect(await liquidator._pool()).to.equal(pool.address)
        })
        
        it('staking pool set correctly', async () => {
            expect(await liquidator._stakingPool()).to.equal(stakingPool.address)
        })
    })

    describe('liquidate', () => {
        beforeEach(async () => {
            await loanToken.fund()
            await withdraw(borrower)
        })

        it('anyone can call it', async () => {
            await timeTravel(provider, defaultedLoanCloseTime)
            await loanToken.close()

            await expect(liquidator.liquidate(loanToken.address))
                .not.to.be.reverted
            await expect(liquidator.connect(otherWallet).liquidate(loanToken.address))
                .not.to.be.reverted
        })

        it('reverts if loan is not defaulted', async () => {
            await expect(liquidator.liquidate(loanToken.address))
                .to.be.revertedWith('LoanToken: Current status should be Defaulted')
            
            await timeTravel(provider, defaultedLoanCloseTime)
            await expect(liquidator.liquidate(loanToken.address))
                .to.be.revertedWith('LoanToken: Current status should be Defaulted')
        })
    })
})