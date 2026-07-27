#!/usr/bin/env bash

set -euo pipefail;

# =========================================================================== #
#                                    Run                                      #
# =========================================================================== #

# Must be inside a git work tree
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2;
  exit 1;
fi

# Get the name of the current branch
BRANCH_NAME="$(git rev-parse --abbrev-ref HEAD)";

if [ "$BRANCH_NAME" = "main" ]; then
  echo "Error: refusing to run on 'main'." >&2;
  exit 1;
fi

# Only commit if there is something to commit, `git commit` fails otherwise and
# would stop the branch being updated at all. Porcelain status is used rather
# than `git diff` because it also reports untracked files.
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

# Switch to main and pull down the latest changes
git checkout main;
git pull;

# Merge with main
git checkout "$BRANCH_NAME";
git merge main;

# Final message
echo "==> Done. '${BRANCH_NAME}' has been updated from main.";
