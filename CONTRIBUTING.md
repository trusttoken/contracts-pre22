# Contributing to TrustToken smart contracts

Thank you for contributing!

If you have a security concern, please see our [security policy](SECURITY.md).
Otherwise here are some development practices we strive to adhere to.

## Workflow

We track releases with semver tags, and we develop directly on our `main` branch.
File pull requests against `main` to have your code reviewed. Every
`main` pull request must

1. pass required CircleCI checks
2. be approved:
  - by 3 Contributors for [deployments-mainnet.json](deployments-mainnet.json).
  - by 2 Contributors for smart contract code.
  - by 1 Contributor for tests and documentation.

We encourage all developers to review all PRs.

## Git practices

:fireworks: Write PR messages in an imperative mood, prepended by an emoji.

Keep PRs as short and sweet as possible. This makes review easier and faster.
Same advice goes for commits.

We squash PRs before merging, so keep the subject lines of commits brief but
informative.

Rebasing your branch against `main` is okay before review. But after someone has
commented, please merge any new changes. This helps avoid rebase headaches and
preserve PR comment history.

Close PRs that aren't ready for review, unless you mark it as Work In Progress
(WIP) and want feedback (but then close the PR after receiving the feedback).

Clean up any merged or abandoned branches. Any branch that hasn't been touched
for over 1 month may be deleted without notice.

## Development practices

All Solidity functions must be unit tested before merging.

Feel free to run the following command from `main` at any time and submit a PR
for obvious minor review:

```sh
$ yarn docs
```

## Deploying

Feel free to deploy up-to-date `main` contracts to Rinkeby at any time from a
clean branch.

1. Test the deployment locally with the `--dry-run` flag to confirm the
update can succeed:

```sh
$ yarn deploy:truefi2 --network rinkeby --dry-run
```

2. Then deploy and verify the contracts on Etherscan:

```sh
$ yarn deploy:truefi2 --network rinkeby --verify
```

3. This should update addresses in [deployments-rinkeby.json](deployments-rinkeby.json).
Confirm these updates are correct before submitting a PR with the updates for
review.

## Code style

We try to adhere to the [Solidity style guide](https://docs.soliditylang.org/en/v0.6.10/style-guide.html).

Thanks! -- The TrustToken team
