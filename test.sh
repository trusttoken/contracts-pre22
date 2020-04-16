#!/bin/bash

set -e

cd $(dirname $0)

ganache-cli -l 0x8954400 --allowUnlimitedContractSize -k istanbul >/dev/null &
GPID=$!
sleep 1
if [ $1 ]
then
    truffle test $@
else
    truffle test test/**/*.js
fi
kill -15 $GPID

exit
