'use strict'

module.exports = {
  ...require('./.mocharc.integration.json'),
  grep: /\[Skip CI]/i,
  invert: true
}
