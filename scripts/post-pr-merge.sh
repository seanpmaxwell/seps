#!/usr/bin/env bash

# `post-pr-merge.sh` — recreate the current branch fresh off main once its pull
# request has been merged.
#
# Verifies the branch's content matches the remote main branch (which is the
# case once a PR is merged, even though a squash-merge gives main different
# commits), then rebuilds the branch from main so it is ready for the next
# round of work.
#
# Usage: ./post-pr-merge.sh
#
# WARNING: this deletes the branch locally and remotely before recreating it.
# Run it only after the pull request has actually been merged.

set -euo pipefail;

# =========================================================================== #
#                                    Run                                      #
# =========================================================================== #

# -- Must be inside a git work tree -- #
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2;
  exit 1;
fi

# -- Get the name of the current branch -- #
BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)";

if [ "$BRANCH_NAME" = "main" ]; then
  echo "Error: refusing to run on 'main'." >&2
  exit 1
fi

# -- Refuse to run with uncommitted work, it would be lost -- #
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: you have uncommitted changes; commit or stash them first." >&2;
  exit 1;
fi

# -- Make sure origin/main is up to date before comparing against it -- #
git fetch origin;

# -- Compare the current branch to the remote main branch -- #
if ! git diff --quiet origin/main; then
  echo "There are unmerged changes with main" >&2;
  exit 1;
fi

echo "==> '${BRANCH_NAME}' matches origin/main, recreating it"

# -- Switch to main and pull down the latest changes -- #
git checkout main;
git pull;

# -- Delete the branch locally and remotely -- #
git branch -D "$BRANCH_NAME"
if git ls-remote --exit-code --heads origin "$BRANCH_NAME" >/dev/null 2>&1; then
  git push origin --delete "$BRANCH_NAME";
else
  echo "No remote branch '${BRANCH_NAME}' to delete, skipping.";
fi

# -- Recreate the branch off the fresh main -- #
git checkout -b "$BRANCH_NAME";

# -- Push the rebuilt branch up as a new remote branch -- #
git push --set-upstream origin "$BRANCH_NAME";

echo "==> Done. '${BRANCH_NAME}' has been recreated from main.";
