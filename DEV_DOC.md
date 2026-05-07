# Git

## Initial steps

After cloning the repo, change git configuration for the repo so that your contributions can be seen in the logs.

```
git config user.name "< your 42 username >"
git config user.email "< your 42 email >"
```

## Branch naming

* `main` branch containing synced changes from all contributors. You should pull from this branch before creating a new working branch. When you have finished working on a specific feature, bugfix, etc, create a pull request to main.
* working branches:
  - `feature/feature-name` : new feature
  - `bugfix/bug-name` : bug fixes
  - `chore/short-description` : maintenance tasks (eg, folder structuring, renaming, updating libraries) 
  - `docs/short-description` : Documentation
  - `test/test-description` : Add or modify tests
  - `refactor/refactor-reason` : Refactoring with no functionality change

## Process

* Create a working branch from `main` with a limited scope, for example: feature/login-page
* Create a pull request (PR) in GitHub for this branch, targeting `main`.
* Have the PR reviewed by another person.
* If everything is correct, merge the PR into `main`.
* If there are no conflicts and merge is successful, delete working branch from Github and local repo

## Commits

Use conventional commit format, [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

`<type>: <description>`

Examples:

```
feat: add login page
fix: fix broken authentication flow
docs: add Git branching process
refactor: simplify user service
test: add login validation tests
chore: update dependencies
```

## Pull requests

Here are some good pull request practices that will make reviews easier:

* The PR should have a limited scope and one clear purpose.
* Add a description explaining the PR with the following sections:
  - Objective: purpose of the PR.
  - Summary of changes: main changes included in the PR.