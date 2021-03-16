import { TrueFiPool, TrueFiPoolFactory, TrueUsd, TrueUsdFactory } from 'contracts/types'
import { BigNumberish } from 'ethers'
import fetch from 'node-fetch'
import { upgradeSuite } from './suite'

const fs = require('fs')

export const save1InchData = async function (pool: TrueFiPool, crv: TrueUsd, blockNumber: BigNumberish) {
    const crvBalanceBefore = await crv.balanceOf(pool.address)
    const dataUrl = `https://api.1inch.exchange/v2.0/swap?disableEstimate=true&fromTokenAddress=0xD533a949740bb3306d119CC777fa900bA034cd52&toTokenAddress=0x0000000000085d4780B73119b644AE5ecd22b376&amount=${crvBalanceBefore.toString()}&fromAddress=0xa1e72267084192Db7387c8CC1328fadE470e4149&slippage=1`
    const body = await (await fetch(dataUrl)).json()
    const data = JSON.stringify(body.tx.data)
    fs.writeFileSync(`test/integration/data/1InchCallData-${blockNumber}.json`, data)
}
