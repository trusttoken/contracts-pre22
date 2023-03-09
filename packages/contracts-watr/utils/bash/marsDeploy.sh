#!/bin/bash
set -eu

# Example usage:
# $ ./utils/bash/marsDeploy.sh scripts/deployment/deploy.ts --network optimism_goerli
# PRIVATE_KEY=0x123..64

# Consume the first argument as a path to the Mars deploy script.
# All other command line arguments get forwarded to Mars.
DEPLOY_SCRIPT="$1"
shift 1

network=''
network_name=''
args="$@"
dry_run='false'
force='false'

while [[ "$@" ]]; do
  case "$1" in
    --network)
      if [ "$2" ]; then
        if [[ "$2" == 'local' ]]; then
          network_name='watr_local'
          network='http://127.0.0.1:8822'
        else
          echo "Error: invalid network parameter: '$2'"
          exit 1
        fi
        shift 1
      fi
      ;;
    --dry-run)
      dry_run='true'
      ;;
    --force)
      force='true'
      ;;
    -?)
      # ignore
      ;;
  esac
  shift 1
done

if [[ "${dry_run}" == 'false' ]]; then
    if [[ "$(git status --porcelain)" ]]; then
        echo "Error: git working directory must be empty to run deploy script."
        exit 1
    fi

    if [[ "$(git log --pretty=format:'%H' -n 1)" != "$(cat ./build/canary.hash)" ]]; then
        echo "Error: Build canary does not match current commit hash. Please run yarn run build."
        exit 1
    fi
fi

# Skip prompt if PRIVATE_KEY variable already exists
if [[ -z "${PRIVATE_KEY:-}" ]]; then
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

if [[ "${network}" == '' ]]; then
  echo "Error: No network provided"
  exit 1
fi

mkdir -p cache

# Log file name
network_log="-${network_name}"
target_file_name="$(basename -- ${DEPLOY_SCRIPT})"
target_log="-${target_file_name%.*}"
dry_run_log=''
if [[ "${dry_run}" == 'true' ]]; then
  dry_run_log='-dry-run'
fi
timestamp_log="-$(date +%s)"

yarn mars
ts-node ${DEPLOY_SCRIPT} \
  --waffle-config ./.waffle.json \
  --network "$network" \
  --out-file "deployments-${network_name}.json" \
  --yes \
  --log "./cache/deploy${network_log}${target_log}${dry_run_log}${timestamp_log}.log"
