#!/bin/bash
ganache-cli -l 0x8954400 --allowUnlimitedContractSize -k istanbul >/dev/null &
GPID=$!
sleep 1
testfile=GasProfile.test.js
mv tests/$testfile test
truffle test test/$testfile
mv test/$testfile tests
kill -15 $GPID
exit
