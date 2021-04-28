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

Feel free to deploy up-to-date `dev` contracts to Ropsten at any time from a
clean branch.

1. Test the deployment locally with the `--dry-run` flag to confirm the
update can succeed:

```sh
$ PRIVATE_KEY={0x123} yarn deploy:truefi --network ropsten --dry-run
```

Note that PRIVATE_KEY might require ownership of the respective contracts.
If you want to deploy your own version of TrueFi from scratch, delete
`deployments.json` or try another testnet.

2. Then deploy and verify the contracts on Etherscan:

```sh
$ PRIVATE_KEY={0x123} yarn deploy:truefi --network ropsten --verify
```

3. This should update addresses in [deployments.json](deployments.json).
Confirm these updates are correct before submitting a PR with the updates for
review.

4. Don't forget to update the Ropsten spreadsheet tab with your new addresses!

## Code style

We try to adhere to the [Solidity style guide](https://docs.soliditylang.org/en/v0.6.10/style-guide.html).

Thanks! -- The TrustToken team
