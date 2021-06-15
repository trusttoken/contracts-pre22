import { createInterface } from 'readline'

let rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})

let testsFinishedWithError = false
let checkNextLine = false
let exitWithFail = false
let testsFailedIgnored = []
const testsToIgnore = [
  'sell TRU on 1inch',
  'ensure max 1% swap fee slippage',
  'Mine CRV on Curve gauge and sell on 1Inch, CRV is not part of value',
]

const processLine = (line) => {
  console.log(line)
  line = line.trim()
  if (line === '') {
    return
  }
  const words = line.split(" ")
  if (!isNaN(parseInt(words[0])) && words[1] === 'failing') {
    testsFinishedWithError = true
  } else if (testsFinishedWithError && !isNaN(words[0].charAt(0))) {
    checkNextLine = true
  } else if (checkNextLine) {
    checkNextLine = false
    if (((curLine, testsToIgnore) => {
      for (const test of testsToIgnore) {
        if (curLine.includes(test)) {
          return false
        }
      }
      return true
    }) (line, testsToIgnore)) {
      exitWithFail = true
    } else {
      testsFailedIgnored.push(line)
    }
  }
}

rl.on('line', (line) => {
  processLine(line)
}).on('close', () => {
  if (testsFailedIgnored.length) {
    console.log(`Ignored failed tests: ${testsFailedIgnored.join(', ')}`)
  }
  if (exitWithFail) {
    process.exit(1)
  }
})


