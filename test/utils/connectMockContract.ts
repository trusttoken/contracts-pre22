// Connect to mock contract without deploying it
// We should add this to Waffle and remove from here

import { Contract, Signer, utils } from 'ethers'
import { Fragment, FunctionFragment, JsonFragment } from '@ethersproject/abi'
import { MockContract } from 'ethereum-waffle'

type ABI = string | Array<Fragment | JsonFragment | string>

const mockAbi = [
  {
    stateMutability: 'payable',
    type: 'fallback',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'target',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: '__waffle__call',
    outputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        internalType: 'bytes',
        name: 'value',
        type: 'bytes',
      },
    ],
    name: '__waffle__mockReturns',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
      {
        internalType: 'string',
        name: 'reason',
        type: 'string',
      },
    ],
    name: '__waffle__mockReverts',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'target',
        type: 'address',
      },
      {
        internalType: 'bytes',
        name: 'data',
        type: 'bytes',
      },
    ],
    name: '__waffle__staticcall',
    outputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

function stub (mockContract: Contract, encoder: utils.AbiCoder, func: utils.FunctionFragment, params?: any[]) {
  const callData = params
    ? mockContract.interface.encodeFunctionData(func, params)
    : mockContract.interface.getSighash(func)

  return {
    returns: async (...args: any) => {
      if (!func.outputs) return
      const encoded = encoder.encode(func.outputs, args)
      await mockContract.__waffle__mockReturns(callData, encoded)
    },
    reverts: async () => mockContract.__waffle__mockReverts(callData, 'Mock revert'),
    revertsWithReason: async (reason: string) => mockContract.__waffle__mockReverts(callData, reason),
    withArgs: (...args: any[]) => stub(mockContract, encoder, func, args),
  }
}

function createMock (abi: ABI, mockContractInstance: Contract) {
  const { functions } = new utils.Interface(abi)
  const encoder = new utils.AbiCoder()

  return Object.values(functions).reduce((acc, func) => {
    const stubbed = stub(mockContractInstance, encoder, func)
    return {
      ...acc,
      [func.name]: stubbed,
      [func.format()]: stubbed,
    }
  }, {} as MockContract['mock'])
}

export function connectMockContract (address: string, signer: Signer, abi: ABI): MockContract {
  const mockContractInstance = new Contract(address, mockAbi, signer)

  const mock = createMock(abi, mockContractInstance)
  const mockedContract = new Contract(mockContractInstance.address, abi, signer) as MockContract
  mockedContract.mock = mock

  const encoder = new utils.AbiCoder()

  mockedContract.staticcall = async (contract: Contract, functionName: string, ...params: any[]) => {
    let func: utils.FunctionFragment = contract.interface.functions[functionName]
    if (!func) {
      func = Object.values(contract.interface.functions).find(f => f.name === functionName) as FunctionFragment
    }
    if (!func) {
      throw new Error(`Unknown function ${functionName}`)
    }
    if (!func.outputs) {
      throw new Error('Cannot staticcall function with no outputs')
    }
    const tx = await contract.populateTransaction[functionName](...params)
    const data = tx.data
    let result
    const returnValue = await mockContractInstance.__waffle__staticcall(contract.address, data)
    result = encoder.decode(func.outputs, returnValue)
    if (result.length === 1) {
      result = result[0]
    }
    return result
  }

  mockedContract.call = async (contract: Contract, functionName: string, ...params: any[]) => {
    const tx = await contract.populateTransaction[functionName](...params)
    const data = tx.data
    return mockContractInstance.__waffle__call(contract.address, data)
  }

  return mockedContract
}
