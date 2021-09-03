import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  OwnedUpgradeabilityProxy,
  TrueFiCreditOracleDeprecated,
} from '../build/artifacts'
import { utils, BigNumber } from 'ethers'

const SCORES = [
  {score: 63, address: '0xb9424fa9bc8c5524c38558146a1b864ea21124b0'},
  {score: 95, address: '0x6C004dBA3f1E83dD060b05b9C888ae14cc027231'},
  {score: 95, address: '0xa8c42bBb0648511cC9004fbDCf0FA365088F862B'},
  {score: 127, address: '0xA294cCa691e4C83B1fc0c8d63D9a3eeF0A196DE1'},
  {score: 127, address: '0xf89ef40b47d6D1A6B84CCb416b728E5D1adE2720'},
  {score: 127, address: '0xb079F40dd951d842f688275100524c09bEf9b4E2'},
  {score: 127, address: '0x052c2a9fd9802Dbb2Bf36Aa5994eEc7f68e56012'},
  {score: 159, address: '0xB608275Fe61A5FDa93713813D17326fC4CD4b976'},
  {score: 159, address: '0x495F8bC43b920279D33d1B34873Ab8832440c322'},
  {score: 159, address: '0xBc8e650Bac6A7590F19A958e0F57ac97261677f0'},
  {score: 159, address: '0x29FCE383c67D00954aC9367f6d3C8215989244eE'},
  {score: 159, address: '0x186cf5714316F47BC59e30a850615A3f938d7D79'},
  {score: 191, address: '0xD5DeE8195AE62bC011A89f1959A7A375cc0DaF38'},
  {score: 191, address: '0xf3537ac805e1ce18AA9F61A4b1DCD04F10a007E9'},
  {score: 191, address: '0x728B77751A7b1Ae29A94901695f3Dd8add37D086'},
  {score: 191, address: '0x931057B79FF539DB5A2813BCb3a3ca5B5242E82C'},
  {score: 191, address: '0x6aD71B4DD5BAE567bCF3376fDc48AC5843E19203'},
  {score: 191, address: '0x2ae5C897107AcC1d98a4e245D93A20A8b5a83428'},
  {score: 223, address: '0x964d9D1A532B5a5DaeacBAc71d46320DE313AE9C'},
  {score: 223, address: '0xEF82e7E85061bd800c040D87D159F769a6b85264'},
  {score: 223, address: '0xA1614eC01d13E04522ED0b085C7a178ED9E99bc9'},
]

deploy({}, (_, config) => {
  const proxy = createProxy(OwnedUpgradeabilityProxy)

  // Existing contracts
  const trueFiCreditOracle = proxy(contract('trueFiCreditOracle', TrueFiCreditOracleDeprecated), () => {})

  // Contract initialization
  runIf(trueFiCreditOracle.isInitialized().not(), () => {
    trueFiCreditOracle.initialize()
  })
  for (let {score, address} of SCORES) {
    runIf(trueFiCreditOracle.getScore(address).equals(score).not(), () => {
      trueFiCreditOracle.setScore(address, score)
    })
  }
})
