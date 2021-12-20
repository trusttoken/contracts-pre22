import { contract, createProxy, deploy } from 'ethereum-mars'
import {
  AvalancheTrueUSD,
  AvalancheTokenController,
  OwnedUpgradeabilityProxy,
} from '../build/artifacts'

deploy({}, () => {
  const proxy = contract(OwnedUpgradeabilityProxy)
})
