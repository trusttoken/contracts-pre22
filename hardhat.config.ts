import 'hardhat-typechain';
import '@nomiclabs/hardhat-waffle'
module.exports = {
  paths: {
    sources: './contracts',
    artifacts: './build',
    cache: './cache',
  },
  typechain: {
    outDir: 'build/types',
    target: 'ethers-v5',
  },
  solidity: {
    version: '0.6.10',
    settings: {
      optimizer: {
        enabled: true,
        runs: 20000,
      },
    },
  },
}
