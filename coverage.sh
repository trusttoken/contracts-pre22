#!/bin/bash
ganache-cli -l 0x7a1200 --allowUnlimitedContractSize -k istanbul >/dev/null &
GPID=$!
sleep 1
truffle run coverage $@
kill -15 $GPID
exit
