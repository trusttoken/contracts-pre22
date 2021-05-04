const fs = require('fs')
const path = require('path')
const { extendConfig } = require('hardhat/config')

const { HardhatPluginError } = require('hardhat/plugins')

const {
  TASK_COMPILE,
} = require('hardhat/builtin-tasks/task-names')

extendConfig(function (config, userConfig) {
  config.abiExporter = Object.assign(
    {
      path: './abi',
      clear: false,
      flat: false,
      only: [],
      except: [],
      spacing: 2,
    },
    userConfig.abiExporter,
  )
})

task(TASK_COMPILE, async function (args, hre, runSuper) {
  const config = hre.config.abiExporter

  await runSuper()

  const outputDirectory = path.resolve(hre.config.paths.root, config.path)

  if (!outputDirectory.startsWith(hre.config.paths.root)) {
    throw new HardhatPluginError('resolved path must be inside of project directory')
  }

  if (outputDirectory === hre.config.paths.root) {
    throw new HardhatPluginError('resolved path must not be root directory')
  }

  if (config.clear) {
    if (fs.existsSync(outputDirectory)) {
      fs.rmdirSync(outputDirectory, { recursive: true })
    }
  }

  if (!fs.existsSync(outputDirectory)) {
    fs.mkdirSync(outputDirectory, { recursive: true })
  }

  for (const fullName of await hre.artifacts.getAllFullyQualifiedNames()) {
    if (config.only.length && !config.only.some(m => fullName.match(m))) continue
    if (config.except.length && config.except.some(m => fullName.match(m))) continue

    const { abi, sourceName, contractName, bytecode, deployedBytecode } = await hre.artifacts.readArtifact(fullName)

    if (!abi.length) continue

    const destination = path.resolve(
      outputDirectory,
      config.flat ? '' : sourceName,
      contractName,
    ) + '.json'

    if (!fs.existsSync(path.dirname(destination))) {
      fs.mkdirSync(path.dirname(destination), { recursive: true })
    }

    fs.writeFileSync(destination, `${JSON.stringify({ abi, bytecode, deployedBytecode }, null, config.spacing)}\n`, { flag: 'w' })
  }
})
