#!/bin/bash

set -e

cd $(dirname $0)

npx ganache-cli -l 0x8954400 --allowUnlimitedContractSize -k istanbul >/dev/null &
GPID=$!
sleep 1
npx truffle test $@
kill -15 $GPID

exit
