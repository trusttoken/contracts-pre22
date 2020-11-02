#!/bin/bash
ganache-cli -l 0x8954400 --allowUnlimitedContractSize -k istanbul >/dev/null &
GPID=$!
sleep 0.1
testfile=GasProfile.test.js
truffle test test/$testfile
kill -15 $GPID
exit
