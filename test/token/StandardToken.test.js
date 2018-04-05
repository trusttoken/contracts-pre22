import basicTokenTests from './BasicToken'
import standardTokenTests from './StandardToken'
const StandardTokenMock = artifacts.require('StandardTokenMock');

contract('StandardToken', function ([_, owner, recipient, anotherAccount]) {
  beforeEach(async function () {
    this.token = await StandardTokenMock.new(owner, 100);
  });

  basicTokenTests([_, owner, recipient, anotherAccount]);
  standardTokenTests([_, owner, recipient, anotherAccount]);
});
