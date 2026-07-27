#!/usr/bin/env bash

# Run a commit/push and set the number of files changed as the commit message
# NOTE: this is for casual backup commits during development, it should not be
# the final commit message when running a PR against main, use 
# `squash-commit-history.sh` before trying to create a PR with main.

set -euo pipefail;

# =========================================================================== #
#                                    Run                                      #
# =========================================================================== #

# Get the current branch name
BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)";

# Exit if currently in `main`
if [ "$BRANCH_NAME" = "main" ]; then
  echo "Error: refusing to run on 'main'." >&2;
  exit 1;
fi

# Only commit if there is something to commit, `git commit` fails otherwise.
# Porcelain status is used rather than `git diff` because it also reports
# untracked files. The push below still runs either way, so a branch with
# nothing to commit still gets its upstream set.
if [ -n "$(git status --porcelain)" ]; then
  # Add all files to the commit
  git add -A;
  # Commit the changes with a timestamp + "# of files changed" message
  TIMESTAMP="$( date +"%Y-%m-%d %H:%M:%S" )";
  FILES_CHANGED="$(git diff --cached --name-only | wc -l | tr -d '[:space:]')";
  git commit -m "Time: ${TIMESTAMP}, ${FILES_CHANGED} files changed";
else
  echo "Nothing to commit.";
fi

# Push the changes remotely. If the remote branch exists a plain `git push`
# works, otherwise the upstream has to be set the first time it is pushed.
if git ls-remote --exit-code --heads origin "$BRANCH_NAME" >/dev/null 2>&1; then
  git push;
else
  git push --set-upstream origin "$BRANCH_NAME";
fi
