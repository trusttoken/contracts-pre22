module.exports = {
  skipFiles: [
    './avalanche',
    './governance/interface',
    './governance/mocks',
    './proxy/interface',
    './proxy/mocks',
    './registry/interface',
    './registry/mocks',
    './true-currencies/interface',
    './true-currencies/mocks',
    './true-gold/interface',
    './true-gold/mocks',
    './truefi/interface',
    './truefi/mocks',
    './truefi2/interface',
    './truefi2/mocks',
    './trusttoken/interface',
    './trusttoken/mocks',
  ],
  mocha: {
    "grep": "gas cost",
    invert: true
  }
}
