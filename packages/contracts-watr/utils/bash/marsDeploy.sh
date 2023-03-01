PRIVATE_KEY=private_key
export PRIVATE_KEY

DEPLOY_SCRIPT="scripts/deployment/deploy.ts"

args="$@"

mkdir -p cache

network='watr'

# Log file name
network_log="-${network}"
target_file_name="$(basename -- ${DEPLOY_SCRIPT})"
target_log="-${target_file_name%.*}"
dry_run_log=''
if [[ "${dry_run}" == 'true' ]]; then
  dry_run_log='-dry-run'
fi
timestamp_log="-$(date +%s)"

pnpm mars
ts-node ${DEPLOY_SCRIPT} \
  --waffle-config ./.waffle.json \
  ${args} \
  --network "http://127.0.0.1:8822" \
  --out-file "deployments-${network}.json" \
  --log "./cache/deploy${network_log}${target_log}${dry_run_log}${timestamp_log}.log"
