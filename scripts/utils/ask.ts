import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

export async function ask (message: string) {
  return new Promise<string>(resolve => {
    rl.question(message, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
