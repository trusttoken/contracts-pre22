const BasicToken = artifacts.require('BasicTokenMock');
import basicTokenTests from './BasicToken'

contract('BasicToken', function ([_, owner, recipient, anotherAccount]) {
  beforeEach(async function () {
    this.token = await BasicToken.new(owner, 100);
  });

  basicTokenTests([_, owner, recipient, anotherAccount]);
});
