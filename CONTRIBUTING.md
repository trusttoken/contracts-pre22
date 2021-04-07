# Contributing to TrustToken smart contracts

Thank you for contributing!

If you have a security concern, please see our [security policy](SECURITY.md).
Otherwise here are some development practices we strive to adhere to.

## Workflow

We track releases with our `master` branch, and we integrate most changes to our
`dev` branch. File pull requests against `dev` to have your code reviewed. Every
`dev` pull request must

1. pass all CircleCI checks
2. be approved:
  - by @hal909, if it's a feature, refactor, or bug fix.
  - by any other reviewer with write access, if it's obvious and minor (e.g.,
merge conflicts, documentation, typo/style fixes, lint fixes, etc.). If you're
unsure whether your PR counts, then it's not obvious and minor.

We encourage all developers to review all PRs.

## Git practices

Keep PRs as short and sweet as possible. This makes review easier and faster.
Same advice goes for commits.

We squash PRs before merging, so keep the subject lines of commits brief but
informative.

Rebasing your branch against `dev` is okay before review. But after someone has
commented, please merge any new changes. This helps avoid rebase headaches and
preserve PR comment history.

Close PRs that aren't ready for review, unless you mark it as Work In Progress
(WIP) and want feedback (but then close the PR after receiving the feedback).

Clean up any merged or abandoned branches. Any branch that hasn't been touched
for over 1 month may be deleted without notice.

## Development practices

All Solidity functions must be unit tested before merging.

Feel free to run either of the following commands from `dev` at any time and
submit PRs for obvious minor review:

```sh
$ yarn docs
```

```sh
$ yarn flatten
```

## Deploying

Feel free to deploy up-to-date `dev` contracts to Ropsten at any time. Deploy
scripts are located under [scripts/](scripts/).

After deploying a contract:
1. Go to https://ropsten.etherscan.io/address/0xNEW_CONTRACT_ADDRESS#contracts
to submit the flattened contract code (found under [flatten/](flatten/)) for
verification. Use the following options to ensure bytecode compatibility:

  - Compiler Type: Solidity (Single file)
  - Compiler Version: v0.6.10+commit.00c0fcaf
  - Open Source License Type: MIT
  - Optimization: Yes
  - Constructor Arguments: <as required>
  - Misc Settings:
    - Runs: 20000
    - EVM Version: default
  - I'm not a robot: :white_check_mark: (bots: no lying!)

If this succeeds, then Etherscan should tell you the contract source code has
been verified.

2. Commit the new contract address here: (TODO).
3. Submit a PR with the committed contract address for review.

## Code style

We try to adhere to the [Solidity style guide](https://docs.soliditylang.org/en/v0.6.10/style-guide.html).

Thanks! -- The TrustToken team
