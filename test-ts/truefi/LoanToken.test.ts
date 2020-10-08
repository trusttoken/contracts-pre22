import { expect } from 'chai'
import { Contract, ContractTransaction, Wallet } from 'ethers'
import { AddressZero, MaxUint256 } from 'ethers/constants'

import { beforeEachWithFixture } from '../utils/beforeEachWithFixture'

import { LoanTokenFactory } from '../../build/types/LoanTokenFactory'
import { LoanToken } from '../../build/types/LoanToken'
import { MockTrueCurrency } from '../../build/types/MockTrueCurrency'
import { MockTrueCurrencyFactory } from '../../build/types/MockTrueCurrencyFactory'
import { TrustTokenFactory } from '../../build/types/TrustTokenFactory'
import { TrustToken } from '../../build/types/TrustToken'
import ITruePoolJson from '../../build/ITruePool.json'
import { deployMockContract } from 'ethereum-waffle'
import { parseEther } from 'ethers/utils'
import { parseTT } from '../utils/parseTT'
import { JsonRpcProvider } from 'ethers/providers'

describe('LoanToken', () => {

    enum LoanTokenStatus {Awaiting, Funded, Closed}

    let owner: Wallet
    let borrower: Wallet
    let loanToken: LoanToken
    let tusd: MockTrueCurrency

    const dayInSeconds = 60 * 60 * 24
    const monthInSeconds = dayInSeconds * 30

    beforeEachWithFixture(async (_provider, wallets) => {
        [owner, borrower] = wallets

        tusd = await new MockTrueCurrencyFactory(owner).deploy()
        await tusd.initialize()
        await tusd.mint(owner.address, parseEther('100000000'))

        loanToken = await new LoanTokenFactory(owner).deploy(
            tusd.address,
            borrower.address,
            parseEther('1000'),
            monthInSeconds * 12,
            1000,
        )

        await tusd.approve(loanToken.address, parseEther('100000000'))
    })

    it('isLoanToken', async () => {
        expect(await loanToken.isLoanToken()).to.be.true
    })

    describe('Constructor', () => {
        it('sets the currency token address', async () => {
            expect(await loanToken.currencyToken()).to.equal(tusd.address)
        })

        it('sets loan params', async () => {
            expect(await loanToken.borrower()).to.equal(borrower.address)
            expect(await loanToken.amount()).to.equal(parseEther('1000'))
            expect(await loanToken.duration()).to.equal(monthInSeconds * 12)
            expect(await loanToken.apy()).to.equal(1000)
            expect(await loanToken.start()).to.be.equal(0)
        })

        it('sets borrrowers debt', async () => {
            expect(await loanToken.debt()).to.equal(parseEther('1100'))
        })
    })

    describe('Fund', () => {
        let creationTimestamp: number

        beforeEach(async () => {
            const tx = await loanToken.fund()
            const { blockNumber } = await tx.wait()
            creationTimestamp = (await loanToken.provider.getBlock(blockNumber)).timestamp
        })

        it('sets status to Funded', async () => {
            expect(await loanToken.status()).to.equal(LoanTokenStatus.Funded)
        })

        it('sets loan start timestamp', async () => {
            expect(await loanToken.start()).to.equal(creationTimestamp)      
        })

        it('mints funders loan tokens', async () => {
            expect(await loanToken.balanceOf(owner.address)).to.equal(parseEther('1100'))
            expect(await loanToken.totalSupply()).to.equal(parseEther('1100'))
        })

        it('transfers proper amount of currency token from funder to loanToken contact', async () => {
            expect(await tusd.balanceOf(loanToken.address)).to.equal(parseEther('1000'))
        })

        it('reverts when funding the same loan token twice', async () => {
            await expect(loanToken.fund())
                .to.be.revertedWith('LoanToken: current status should be Awaiting')
        })
    })
})
