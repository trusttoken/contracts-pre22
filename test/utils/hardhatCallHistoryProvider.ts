import { waffle } from 'hardhat'
import { utils } from 'ethers'

const callHistory = []

const init = (waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._wrapped._init
;(waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._wrapped._init = async function () {
  await init.apply(this)
  if ((waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._wrapped._node._vmTracer._vm.listenerCount('beforeMessage') < 2) {
    (waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._wrapped._node._vmTracer._vm.on('beforeMessage', (message) => {
      if (message.to) {
        callHistory.push({
          address: utils.getAddress(message.to.toString()),
          data: `0x${message.data.toString('hex')}`,
        })
      }
    })
  }
}

const proxyProvider = new Proxy(waffle.provider, {
  get (target: any, name) {
    if (name === 'callHistory') {
      return callHistory
    }
    return target[name]
  },
})

proxyProvider.clearCallHistory = () => {
  callHistory.length = 0
}

export { proxyProvider }
