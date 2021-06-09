/**
 * PRIVATE_KEY={private_key} ts-node scripts/register_credit_scores.ts "{network}"
 */
import { ethers, providers } from 'ethers'

import {
  TrueFiCreditOracle__factory,
} from '../build'

// inputs
const oracleAddressMainnet = '0x73581551665680696946f568259977Da02e8712A'
const txnArgs = { gasLimit: 1_000_000, gasPrice: 60_000_000_000 }

// testnet
let oracleAddress = '0x9ff6ca759631E658444Ba85409a283f55C49bb93'

async function registerCreditScores () {
  const network = process.argv[2]
  const provider = new providers.InfuraProvider(network, 'e33335b99d78415b82f8b9bc5fdc44c0')
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

  if (network === 'mainnet') {
    oracleAddress = oracleAddressMainnet
  }

  const oracle = await TrueFiCreditOracle__factory.connect(oracleAddress, wallet)
  const scores = getScores()

  for (let i = 0; i < scores.length; i++){
    await setScore(oracle, scores[i].score, scores[i].address)
  }
  console.log(`\nDONE.`)
}

async function setScore (oracle, score, address) {
  if ((await oracle.getScore(address)).toString() != score.toString()) {
    await (await oracle.setScore(address, score, txnArgs)).wait()
    console.log(`SET:   ${address}: ${score}`)
  }
  else {
    console.log(`CHECK: ${address}: ${score}`)
  }
}

async function isScoreSet(oracle, score, address) {

}

function getScores () {
  return [
    { score: 223, address: '0xEF82e7E85061bd800c040D87D159F769a6b85264' }, // Amber Group
    { score: 159, address: '0xCAFD96A3475aa9afcC66bc5f9FF589C74ce6A4Bc' }, // Invictus
    { score: 191, address: '0xBc8e650Bac6A7590F19A958e0F57ac97261677f0' }, // Kbit
    { score: 223, address: '0xdcf45Ec32B553C8274596CD6401dD78A0fAc8CC1' }, // WinterMute
    { score: 223, address: '0x964d9D1A532B5a5DaeacBAc71d46320DE313AE9C' }, // Alameda
  ]
}

registerCreditScores().catch(console.error)
