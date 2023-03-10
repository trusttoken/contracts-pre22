import '@typechain/hardhat'
import '@nomiclabs/hardhat-waffle'
import './abi-exporter'

import compiler from './.compiler.json'

module.exports = {
  paths: {
    sources: './contracts',
    artifacts: './build',
    cache: './cache',
  },
  abiExporter: {
    path: './build',
    flat: true,
    spacing: 2,
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
  },
  typechain: {
    outDir: 'build/types',
    target: 'ethers-v5',
  },
  solidity: {
    compilers: [compiler],
  },
}
