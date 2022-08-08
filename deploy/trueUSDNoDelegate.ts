import { contract, createProxy, deploy } from 'ethereum-mars'
import {
  TrueUSD
} from '../build/artifacts'

deploy({}, () => {
  contract(TrueUSD)
})
