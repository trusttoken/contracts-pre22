import {expect} from "chai";
import {
  ManagedPortfolio,
  ManagedPortfolio__factory,
  MockUsdc,
  MockUsdc__factory,
} from "contracts";
import {beforeEachWithFixture, parseUSDC} from "utils";

describe("Issuing a loan", () => {
  let portfolio: ManagedPortfolio;
  let token: MockUsdc;

  let portfolioOwner;
  let lender;
  let tokenAsLender;
  let portfolioAsLender;
  beforeEachWithFixture(async (wallets) => {
    [portfolioOwner, lender] = wallets;
    token = await new MockUsdc__factory(portfolioOwner).deploy();
    portfolio = await new ManagedPortfolio__factory(portfolioOwner).deploy(
      token.address
    );
    portfolioAsLender = portfolio.connect(lender);
    tokenAsLender = token.connect(lender);
    await token.mint(lender.address, parseUSDC(1));
  });

  it("joining a portfolio", async () => {
    await token.connect(lender).approve(portfolio.address, parseUSDC(1));
    await portfolio.connect(lender).join(parseUSDC(1));
    expect(await token.balanceOf(portfolio.address)).to.eq(parseUSDC(1));
  });
});
