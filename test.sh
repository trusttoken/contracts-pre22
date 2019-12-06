#!/bin/bash
ganache-cli --version
ganache-cli -l 0x8954400 --allowUnlimitedContractSize -k istanbul >/dev/null &
GPID=$!
sleep 1
truffle test $@
kill -15 $GPID
exit
