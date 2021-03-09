import { upgradeSuite } from './suite'
import { TrueFiPoolFactory, TrueUsdFactory } from 'contracts'
import fetch from 'node-fetch'
import { expect } from 'chai'

describe('Pool exchanges', () => {
  it('sells all available CRV with 1inch', async () => {
    const pool = await upgradeSuite(TrueFiPoolFactory, '0xa1e72267084192Db7387c8CC1328fadE470e4149', [])
    const tusd = TrueUsdFactory.connect('0x0000000000085d4780B73119b644AE5ecd22b376', pool.signer)
    const crv = TrueUsdFactory.connect('0xD533a949740bb3306d119CC777fa900bA034cd52', pool.signer)
    const crvBalanceBefore = await crv.balanceOf(pool.address)
    const dataUrl = `https://api.1inch.exchange/v2.0/swap?disableEstimate=true&fromTokenAddress=0xD533a949740bb3306d119CC777fa900bA034cd52&toTokenAddress=0x0000000000085d4780B73119b644AE5ecd22b376&amount=${crvBalanceBefore.toString()}&fromAddress=0xa1e72267084192Db7387c8CC1328fadE470e4149&slippage=1`
    const body = await (await fetch(dataUrl)).json()
    const data = body.tx.data
    await (await pool.set1InchAddress('0x111111125434b319222cdbf8c261674adb56f3ae')).wait()
    const balanceBefore = await tusd.balanceOf(pool.address)
    await (await pool.sellCrvWith1Inch(data)).wait()
    const balanceAfter = await tusd.balanceOf(pool.address)
    const crvBalanceAfter = await crv.balanceOf(pool.address)
    expect(crvBalanceAfter).to.equal(0)
    expect(balanceAfter.sub(balanceBefore)).to.be.gt(0)
  })

  it('deposit TUSD to Curve', async () => {
    const pool = await upgradeSuite(TrueFiPoolFactory, '0xa1e72267084192Db7387c8CC1328fadE470e4149', [])
    const tusdBalance = await pool.currencyBalance()
    const minAmount = (await pool.calcTokenAmount(tusdBalance)).mul(99).div(100)
    await expect(pool.flush(tusdBalance, minAmount)).to.be.not.reverted
  }).timeout(100000000)
})
