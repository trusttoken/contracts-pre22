import { waffle } from 'hardhat'
import { utils } from 'ethers'

let callHistory = []
let subscribed = false

const init = (waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._wrapped._init
;(waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._wrapped._init = async function () {
  await init.apply(this)
  if (!subscribed) {
    (waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._wrapped._node._vmTracer._vm.on('beforeMessage', (message) => {
      if (message.to) {
        callHistory.push({
          address: utils.getAddress(message.to.toString()),
          data: `0x${message.data.toString('hex')}`,
        })
      }
    })
    subscribed = true
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
  callHistory = []
}

export { proxyProvider }
