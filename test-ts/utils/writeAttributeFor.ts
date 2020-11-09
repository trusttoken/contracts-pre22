import Web3 from 'web3'

const { utils } = new Web3()

export const canWriteTo = Buffer.from(utils.sha3('canWriteTo-').slice(2), 'hex')

export function writeAttributeFor (attribute) {
  const bytes = Buffer.from(attribute.slice(2), 'hex')
  for (let index = 0; index < canWriteTo.length; index++) {
    bytes[index] ^= canWriteTo[index]
  }
  return utils.sha3('0x' + bytes.toString('hex'))
}

// import { keccak256 } from '@ethersproject/solidity'
// import { formatBytes32String } from '@ethersproject/strings'

// export const canWriteTo = Buffer.from(keccak256(['string'], [formatBytes32String('canWriteTo-')]).slice(2), 'hex')

// export const writeAttributeFor = (attribute: string) => {
//   const bytes = Buffer.from(attribute.slice(2), 'hex')
//   for (let index = 0; index < canWriteTo.length; index++) {
//     bytes[index] ^= canWriteTo[index]
//   }
//   return keccak256(['string'], ['0x' + bytes.toString('hex')])
// }
