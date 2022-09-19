import { expect } from 'chai'

const { ethers } = require("hardhat");

describe('DummyContract', () => {

  it('should have a constructor', async () => {
    const DummyContract = await ethers.getContractFactory("contracts/DummyContract.sol:DummyContract");
    const dummyContract = await DummyContract.deploy();

    expect(await dummyContract.getValue()).to.eq(5)
  })
})
