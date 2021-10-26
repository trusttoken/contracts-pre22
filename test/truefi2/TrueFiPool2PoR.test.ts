import {expect, use} from "chai";
import {
  TrueFiPool2,
  MockTrueCurrency,
  TestLoanFactory,
  TestLoanFactory__factory,
  LineOfCreditAgency,
  TrueFiCreditOracle,
  CreditModel,
  FixedTermLoanAgency,
  TestTrueLender,
  TestTrueLender__factory,
  BorrowingMutex,
  TrueFiPool2PoR__factory,
  TrueFiPool2PoR,
  MockV3Aggregator,
  MockV3Aggregator__factory,
} from "contracts";
import {MockProvider, solidity} from "ethereum-waffle";
import {BigNumber, Wallet, BigNumberish} from "ethers";
import {AddressZero} from "@ethersproject/constants";
import {
  beforeEachWithFixture,
  parseEth,
  setUtilization as _setUtilization,
  setupTruefi2,
  timeTravel as _timeTravel,
} from "utils";
import {Deployer, setupDeploy} from "scripts/utils";

use(solidity);

// = base * 10^{exponent}
const exp = (base: BigNumberish, exponent: BigNumberish): BigNumber => {
  return BigNumber.from(base).mul(BigNumber.from(10).pow(exponent));
};

describe("TrueFiPool2PoR", () => {
  const ONE_DAY_SECONDS = 24 * 60 * 60; // seconds in a day
  const TUSD_FEED_INITIAL_ANSWER = exp(1_000_000, 8).toString(); // "1M TUSD in reserves"
  let provider: MockProvider;
  let owner: Wallet;
  let borrower: Wallet;
  let borrower2: Wallet;
  let borrower3: Wallet;
  let creditAgency: LineOfCreditAgency;
  let creditOracle: TrueFiCreditOracle;
  let tusd: MockTrueCurrency;
  let tusdPool: TrueFiPool2PoR;
  let usdcPool: TrueFiPool2;
  let loanFactory: TestLoanFactory;
  let lender: TestTrueLender;
  let deployContract: Deployer;
  let creditModel: CreditModel;
  let ftlAgency: FixedTermLoanAgency;
  let borrowingMutex: BorrowingMutex;
  let poolImplementation: TrueFiPool2PoR;
  let mockV3Aggregator: MockV3Aggregator;

  let timeTravel: (time: number) => void;
  let setUtilization: (utilization: number) => void;

  beforeEachWithFixture(async (wallets, _provider) => {
    [owner, borrower, borrower2, borrower3] = wallets;
    deployContract = setupDeploy(owner);
    timeTravel = (time: number) => _timeTravel(_provider, time);
    provider = _provider;

    mockV3Aggregator = await deployContract(
      MockV3Aggregator__factory,
      "18",
      TUSD_FEED_INITIAL_ANSWER
    );
    lender = await deployContract(TestTrueLender__factory);
    loanFactory = await deployContract(TestLoanFactory__factory);
    poolImplementation = await deployContract(TrueFiPool2PoR__factory);
    ({
      standardToken: tusd,
      lender,
      standardPool: tusdPool,
      feePool: usdcPool,
      loanFactory,
      creditAgency,
      creditOracle,
      creditModel,
      ftlAgency,
      borrowingMutex,
    } = await setupTruefi2(owner, provider, {
      lender: lender,
      loanFactory: loanFactory,
      poolImplementation,
    }));

    await tusd.mint(owner.address, parseEth(1e7));

    // Set the TUSD Pool PoR feed to our mocked aggregator
    await tusdPool.setFeed(mockV3Aggregator.address);

    await tusdPool.setCreditAgency(creditAgency.address);
    await tusdPool.setFixedTermLoanAgency(ftlAgency.address);
    await creditModel.setRiskPremium(700);

    for (const wallet of [borrower, borrower2, borrower3]) {
      await creditOracle.setScore(wallet.address, 255);
      await creditOracle.setMaxBorrowerLimit(
        wallet.address,
        parseEth(100_000_000)
      );
      await creditAgency.allowBorrower(wallet.address, true);
    }

    await ftlAgency.allowBorrower(borrower.address);

    setUtilization = (utilization: number) =>
      _setUtilization(
        tusd,
        borrower2,
        borrower3,
        ftlAgency,
        owner,
        tusdPool,
        utilization
      );

    await borrowingMutex.allowLocker(owner.address, true);
  });

  describe("Proof-of-reserves check", () => {
    const amountToDeposit = parseEth(1e6);

    beforeEach(async () => {
      await tusd.mint(owner.address, amountToDeposit);
      await tusd.connect(owner).approve(tusdPool.address, amountToDeposit);

      // Reset pool PoR feed defaults
      await tusdPool.setFeed(mockV3Aggregator.address);
      await tusdPool.setHeartbeat(0);

      // Set fresh, valid answer on mock PoR feed
      const tusdSupply = await tusd.totalSupply();
      await mockV3Aggregator.updateAnswer(tusdSupply);
    });

    it("should mint successfully when feed is unset", async () => {
      // Make sure feed is unset
      await tusdPool.setFeed(AddressZero);
      expect(await tusdPool.feed()).to.equal(AddressZero);

      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await tusdPool.connect(owner).join(amountToDeposit);
      expect(await tusdPool.balanceOf(owner.address)).to.equal(
        balanceBefore.add(amountToDeposit)
      );
    });

    it("should mint successfully when feed is set, but heartbeat is unset (defaulting to MAX_AGE)", async () => {
      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await tusdPool.connect(owner).join(amountToDeposit, {
        gasLimit: 200_000,
      });
      expect(await tusdPool.balanceOf(owner.address)).to.equal(
        amountToDeposit.add(balanceBefore)
      );
    });

    it("should mint successfully when both feed and heartbeat are set", async () => {
      // Set heartbeat to 1 day
      await tusdPool.setHeartbeat(ONE_DAY_SECONDS);
      expect(await tusdPool.heartbeat()).to.equal(ONE_DAY_SECONDS);

      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await tusdPool.connect(owner).join(amountToDeposit);
      expect(await tusdPool.balanceOf(owner.address)).to.equal(
        balanceBefore.add(amountToDeposit)
      );
    });

    it("should mint successfully when feed decimals < underlying decimals", async () => {
      // Re-deploy a mock aggregator with fewer decimals
      const currentTusdSupply = await tusd.totalSupply();
      const mockV3AggregatorWith6Decimals = await deployContract(
        MockV3Aggregator__factory,
        "6",
        currentTusdSupply.div(exp(1, 12)).toString()
      );
      // Set feed and heartbeat on newly-deployed aggregator
      await tusdPool.setFeed(mockV3AggregatorWith6Decimals.address);
      expect(await tusdPool.feed()).to.equal(
        mockV3AggregatorWith6Decimals.address
      );
      await tusdPool.setHeartbeat(ONE_DAY_SECONDS);
      expect(await tusdPool.heartbeat()).to.equal(ONE_DAY_SECONDS);

      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await tusdPool.connect(owner).join(amountToDeposit);
      expect(await tusdPool.balanceOf(owner.address)).to.equal(
        balanceBefore.add(amountToDeposit)
      );
    });

    it("should mint successfully when feed decimals > underlying decimals", async () => {
      // Re-deploy a mock aggregator with more decimals
      const currentTusdSupply = await tusd.totalSupply();
      const mockV3AggregatorWith20Decimals = await deployContract(
        MockV3Aggregator__factory,
        "20",
        currentTusdSupply.mul(exp(1, 2)).toString()
      );
      // Set feed and heartbeat on newly-deployed aggregator
      await tusdPool.setFeed(mockV3AggregatorWith20Decimals.address);
      expect(await tusdPool.feed()).to.equal(
        mockV3AggregatorWith20Decimals.address
      );
      await tusdPool.setHeartbeat(ONE_DAY_SECONDS);
      expect(await tusdPool.heartbeat()).to.equal(ONE_DAY_SECONDS);

      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await tusdPool.connect(owner).join(amountToDeposit);
      expect(await tusdPool.balanceOf(owner.address)).to.equal(
        balanceBefore.add(amountToDeposit)
      );
    });

    it("should mint successfully when underlying supply == proof-of-reserves", async () => {
      // Set heartbeat to 1 day
      await tusdPool.setHeartbeat(ONE_DAY_SECONDS);
      expect(await tusdPool.heartbeat()).to.equal(ONE_DAY_SECONDS);

      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await tusdPool.connect(owner).join(amountToDeposit);
      expect(await tusdPool.balanceOf(owner.address)).to.equal(
        balanceBefore.add(amountToDeposit)
      );
    });

    it("should revert if underlying supply > proof-of-reserves", async () => {
      // Re-deploy aggregator with fewer TUSD in reserves
      const currentTusdSupply = await tusd.totalSupply();
      const notEnoughReserves = currentTusdSupply.sub("1");
      await mockV3Aggregator.updateAnswer(notEnoughReserves);

      // Set heartbeat to 1 day
      await tusdPool.setHeartbeat(ONE_DAY_SECONDS);
      expect(await tusdPool.heartbeat()).to.equal(ONE_DAY_SECONDS);

      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await expect(
        tusdPool.connect(owner).join(amountToDeposit)
      ).to.be.revertedWith(
        "TrueFiPool: underlying supply exceeds proof-of-reserves"
      );
      expect(await tusdPool.balanceOf(owner.address)).to.equal(balanceBefore);
    });

    it("should revert if the feed is not updated within the heartbeat", async () => {
      // Set heartbeat to 1 day
      await tusdPool.setHeartbeat(ONE_DAY_SECONDS);
      expect(await tusdPool.heartbeat()).to.equal(ONE_DAY_SECONDS);

      // Heartbeat is set to 1 day, so fast-forward 2 days
      timeTravel(2 * ONE_DAY_SECONDS);

      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await expect(
        tusdPool.connect(owner).join(amountToDeposit)
      ).to.be.revertedWith("TrueFiPool: PoR answer too old");
      expect(await tusdPool.balanceOf(owner.address)).to.equal(balanceBefore);
    });

    it("should revert if feed returns an invalid answer", async () => {
      // Update feed with invalid answer
      await mockV3Aggregator.updateAnswer(0);

      // Set heartbeat to 1 day
      await tusdPool.setHeartbeat(ONE_DAY_SECONDS);
      expect(await tusdPool.heartbeat()).to.equal(ONE_DAY_SECONDS);

      // Deposit TUSD - the pool will call the feed before minting to check PoR
      const balanceBefore = await tusdPool.balanceOf(owner.address);
      await expect(
        tusdPool.connect(owner).join(amountToDeposit)
      ).to.be.revertedWith("TrueFiPool: Invalid answer from PoR feed");
      expect(await tusdPool.balanceOf(owner.address)).to.equal(balanceBefore);
    });
  });
});
