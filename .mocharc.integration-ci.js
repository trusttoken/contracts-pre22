'use strict'

module.exports = {
  ...require('./.mocharc.integration.json'),
  grep: /(1Inch|Curve)/i,
  invert: true
}
