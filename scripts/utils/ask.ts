import readline from 'readline'

export async function ask (message: string) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise<string>(resolve => {
    rl.question(message, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
