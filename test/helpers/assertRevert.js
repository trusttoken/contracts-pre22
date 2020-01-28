export default async promise => {
  try {
    await promise;
    assert.fail('Revert not received');
  } catch (error) {
    const revertFound = error.message.search('revert') >= 0 || error.message.search('invalid opcode') >= 0 || error.message.search('invalid JUMP') >= 0;
    assert(revertFound, `Expected "revert", got ${error} instead`);
  }
};
