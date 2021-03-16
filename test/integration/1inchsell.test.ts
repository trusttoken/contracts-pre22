import { upgradeSuite } from './suite'
import { TrueFiPoolFactory, TrueUsdFactory } from 'contracts'
import { expect } from 'chai'
import { save1InchData } from './1inchScript'
import fs from 'fs'

const BLOCK_NUMBER = 12049173

describe('Pool 1Inch integration', () => {
  it('sells all available CRV', async () => {
    const pool = await upgradeSuite(TrueFiPoolFactory, '0xa1e72267084192Db7387c8CC1328fadE470e4149', [], undefined, BLOCK_NUMBER)
    const tusd = TrueUsdFactory.connect('0x0000000000085d4780B73119b644AE5ecd22b376', pool.signer)
    const crv = TrueUsdFactory.connect('0xD533a949740bb3306d119CC777fa900bA034cd52', pool.signer)

    if (!fs.existsSync(`test/integration/data/1InchCallData-${BLOCK_NUMBER}.json`)) {
      // block number in json data name, means only that it is compatible with that block number, not that the data comes from said block
      await save1InchData(pool, crv, BLOCK_NUMBER)
    }

    const data = JSON.parse(fs.readFileSync(`test/integration/data/1InchCallData-${BLOCK_NUMBER}.json`).toString())

    await (await pool.set1InchAddress('0x111111125434b319222cdbf8c261674adb56f3ae')).wait()
    const balanceBefore = await tusd.balanceOf(pool.address)
    await (await pool.sellCrvWith1Inch(data)).wait()
    const balanceAfter = await tusd.balanceOf(pool.address)
    const crvBalanceAfter = await crv.balanceOf(pool.address)
    expect(crvBalanceAfter).to.equal(0)
    expect(balanceAfter.sub(balanceBefore)).to.be.gt(0)
  }).timeout(100000000)
})
