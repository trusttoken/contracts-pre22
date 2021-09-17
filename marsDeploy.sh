#!/bin/bash
set -eu

# Example usage:
# $ ./marsDeploy.sh deploy/truefi.ts --network ropsten --dry-run
# PRIVATE_KEY=0x123..64

# Consume the first argument as a path to the Mars deploy script.
# All other command line arguments get forwarded to Mars.
DEPLOY_SCRIPT="$1"
shift 1

if [ "$(git status --porcelain)" ]; then
    echo "Error: git working directory must be empty to run deploy script."
    exit 1
fi

if [ "$(git log --pretty=format:'%H' -n 1)" != "$(cat ./build/canary.hash)" ]; then
    echo "Error: Build canary does not match current commit hash. Please run yarn build."
    exit 1
fi

# Skip PRIVATE_KEY prompt if --yes flag passed
if [[ ! " $@ " =~ " --yes " ]]; then
  # Prompt the user for a PRIVATE_KEY without echoing to bash output.
  # Then export PRIVATE_KEY to an environment variable that won't get
  # leaked to bash history.
  #
  # WARNING: environment variables are still leaked to the process table
  # while a process is running, and hence visible in a call to `ps -E`.
  echo "Enter a private key (0x{64 hex chars}) for contract deployment,"
  echo "or leave blank if performing a dry run without authorization."
  read -s -p "PRIVATE_KEY=" PRIVATE_KEY
  export PRIVATE_KEY
fi
export INFURA_KEY="ec659e9f6af4425c8a13aeb0af9f2809"
export ETHERSCAN_KEY="XQPPJGFR4J3I6PEISYEG4JPETFZ2EF56EX"

yarn mars
yarn ts-node ${DEPLOY_SCRIPT} \
  --waffle-config ./.waffle.json \
  "$@"
