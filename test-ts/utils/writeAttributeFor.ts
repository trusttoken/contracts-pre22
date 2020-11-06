import Web3 from 'web3'

const {utils} = new Web3()

export const canWriteTo = Buffer.from(utils.sha3('canWriteTo-').slice(2), 'hex')

export function writeAttributeFor (attribute) {
  const bytes = Buffer.from(attribute.slice(2), 'hex')
  for (let index = 0; index < canWriteTo.length; index++) {
    bytes[index] ^= canWriteTo[index]
  }
  return utils.sha3('0x' + bytes.toString('hex'))
}

// import { keccak256 } from '@ethersproject/keccak256'
// import { formatBytes32String } from '@ethersproject/strings'

// const canWriteTo = Buffer.from(keccak256(formatBytes32String('canWriteTo-')).slice(2), 'hex')

// function writeAttributeFor(attribute: string) {
//   const bytes = Buffer.from(attribute.slice(2), 'hex')
//   for (let index = 0; index < canWriteTo.length; index++) {
//     bytes[index] ^= canWriteTo[index]
//   }
//   return keccak256('0x' + bytes.toString('hex'))
// }
