import { waffle } from 'hardhat'
import type { RecordedCall } from 'ethereum-waffle'
import { utils } from 'ethers'

const init = (waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._init

function patchSkipGasCostCheck() {
  const originalProcess = (waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._ethModule.processRequest.bind(
    (waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._ethModule,
  )
  ;(waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._ethModule.processRequest = (
    method: string,
    params: any[],
  ) => {
    if (method === 'eth_estimateGas') {
      return '0xB71B00'
    } else {
      return originalProcess(method, params)
    }
  }
}

class CallHistory {
  recordedCalls: RecordedCall[] = [];

  addUniqueCall(call: RecordedCall) {
    if (!this.recordedCalls.find(c => c.address === call.address && c.data === call.data)) {
      this.recordedCalls.push(call)
    }
  }

  clearAll() {
    this.recordedCalls = []
  }
}

function toRecordedCall(message: any): RecordedCall {
  return {
    address: message.to?.buf ? utils.getAddress(utils.hexlify(message.to.buf)) : undefined,
    data: message.data ? utils.hexlify(message.data) : '0x',
  }
}

const callHistory = new CallHistory();
(waffle.provider as any).clearCallHistory = () => {
  callHistory.clearAll()
}

let beforeMessageListener: (message: any) => void | undefined;

(waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._init = async function () {
  await init.apply(this)
  if (typeof beforeMessageListener === 'function') {
    // hast to be here because of weird behaviour of init function
    (waffle.provider as any)
      ._hardhatNetwork
      .provider
      ._wrapped
      ._wrapped
      ._wrapped
      ._node
      ._vmTracer
      ._vm
      .off('beforeMessage', beforeMessageListener)
  }
  if ((waffle.provider as any)._hardhatNetwork.provider._wrapped._wrapped._wrapped._node._vmTracer._vm.listenerCount('beforeMessage') < 2) {
    patchSkipGasCostCheck()
  }
  beforeMessageListener = (message: any) => {
    callHistory.addUniqueCall(toRecordedCall(message))
  }
  const provider: any = waffle.provider
  provider.callHistory = callHistory.recordedCalls;
  (waffle.provider as any)
    ._hardhatNetwork.provider
    ._wrapped._wrapped
    ._wrapped
    ._node
    ._vmTracer
    ._vm
    .on('beforeMessage', beforeMessageListener)
}
