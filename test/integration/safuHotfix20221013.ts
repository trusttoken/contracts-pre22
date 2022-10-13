import { forkChain } from './suite20221013'
import { setupDeploy } from 'scripts/utils'
import { Erc20, Erc20__factory, LoanToken2, LoanToken2__factory, OwnedUpgradeabilityProxy__factory, Safu, Safu__factory, TrueFiPool2, TrueFiPool2__factory } from 'contracts'
import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { parseEth } from 'utils'
import { JsonRpcSigner } from '@ethersproject/providers'

use(solidity)

describe('SAFU hotfix 2022-10-13', () => {
  const SAFU_OWNER = '0x16cEa306506c387713C70b9C1205fd5aC997E78E'
  const SAFU_ADDRESS = '0x1eA63189eB1F4c109B10Cf6567f328C826AA6151'
  const TFBUSD_ADDRESS = '0x1Ed460D149D48FA7d91703bf4890F97220C09437'
  const LOAN_ADDRESS = '0x4A66a867f52DF4Ed1D8580A1C383B2dD036a3C47'
  const ETH_HOLDER = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
  const BUSD_HOLDER = '0xF977814e90dA44bFA03b6295A0616a897441aceC'
  const BUSD_ADDRESS = '0x4Fabb145d64652a948d72533023f6E7A623C7C53'
  const BLOCK_NUMBER = 15734123 // 2022-10-12

  let safuOwner: JsonRpcSigner
  let safu: Safu
  let tfBUSD: TrueFiPool2
  let loan: LoanToken2
  let busd: Erc20

  beforeEach(async () => {
    const provider = forkChain([SAFU_OWNER, ETH_HOLDER, BUSD_HOLDER], BLOCK_NUMBER - 1)

    safuOwner = provider.getSigner(SAFU_OWNER)
    safu = Safu__factory.connect(SAFU_ADDRESS, safuOwner)
    loan = LoanToken2__factory.connect(LOAN_ADDRESS, safuOwner)
    tfBUSD = TrueFiPool2__factory.connect(TFBUSD_ADDRESS, safuOwner)

    const ethHolder = provider.getSigner(ETH_HOLDER)
    await ethHolder.sendTransaction({ value: parseEth(100), to: SAFU_OWNER })

    const busdHolder = provider.getSigner(BUSD_HOLDER)
    busd = Erc20__factory.connect(BUSD_ADDRESS, busdHolder)
  })

  describe('before SAFU upgrade', () => {
    it('tfBUSD pool value includes 100% of deficiency token value', async () => {
      await safu.liquidate(loan.address)

      const poolValue = await tfBUSD.poolValue()
      const totalSupply = await tfBUSD.totalSupply()
      const deficitValue = await tfBUSD.deficitValue()
      const liquidValue = await tfBUSD.liquidValue()
      const loansValue = await tfBUSD.loansValue()

      expect(totalSupply).to.be.lt(poolValue)
      expect(deficitValue).to.equal(await loan.debt())
      expect(poolValue).to.equal(liquidValue.add(loansValue).add(deficitValue))
    })

    it('SAFU transfers BUSD tokens to pool during liquidation', async () => {
      await busd.transfer(safu.address, parseEth(1_000_000_000))

      const liquidValueBefore = await tfBUSD.liquidValue()

      await safu.liquidate(loan.address)

      const poolValue = await tfBUSD.poolValue()
      const totalSupply = await tfBUSD.totalSupply()
      const deficitValue = await tfBUSD.deficitValue()
      const liquidValue = await tfBUSD.liquidValue()
      const loansValue = await tfBUSD.loansValue()

      expect(totalSupply).to.be.lt(poolValue)
      expect(deficitValue).to.equal(0)
      expect(poolValue).to.equal(liquidValue.add(loansValue))
      expect(liquidValue).to.equal(liquidValueBefore.add(await loan.debt()))
    })
  })

  describe('after SAFU upgrade', () => {
    beforeEach(async () => {
      const deployContract = setupDeploy(safuOwner)
      const newSAFU = await deployContract(Safu__factory)
      const safuProxy = OwnedUpgradeabilityProxy__factory.connect(SAFU_ADDRESS, safuOwner)
      await safuProxy.upgradeTo(newSAFU.address)
    })

    it('tfBUSD pool value includes 0% of deficiency token value', async () => {
      await safu.liquidate(loan.address)

      const poolValue = await tfBUSD.poolValue()
      const totalSupply = await tfBUSD.totalSupply()
      const deficitValue = await tfBUSD.deficitValue()
      const liquidValue = await tfBUSD.liquidValue()
      const loansValue = await tfBUSD.loansValue()

      expect(totalSupply).to.be.gt(poolValue)
      expect(deficitValue).to.equal(0)
      expect(poolValue).to.equal(liquidValue.add(loansValue))
    })

    it('SAFU does not transfer BUSD tokens to pool during liquidation', async () => {
      await busd.transfer(safu.address, parseEth(1_000_000_000))

      const liquidValueBefore = await tfBUSD.liquidValue()

      await safu.liquidate(loan.address)

      const poolValue = await tfBUSD.poolValue()
      const totalSupply = await tfBUSD.totalSupply()
      const deficitValue = await tfBUSD.deficitValue()
      const liquidValue = await tfBUSD.liquidValue()
      const loansValue = await tfBUSD.loansValue()

      expect(totalSupply).to.be.gt(poolValue)
      expect(deficitValue).to.equal(0)
      expect(poolValue).to.equal(liquidValue.add(loansValue))
      expect(liquidValue).to.equal(liquidValueBefore)
    })
  })
})
