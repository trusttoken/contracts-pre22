import { contract, createProxy, deploy, runIf } from 'ethereum-mars'
import {
  TrueFiVault,
} from '../build/artifacts'

deploy({}, (_, config) => {
  const trueFiVaultImpl = contract(TrueFiVault)
})
