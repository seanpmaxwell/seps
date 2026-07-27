#!/usr/bin/env bash

# `publish.sh` — publish the package from main, then return to whatever branch
# you started on.
#
# Usage: ./publish.sh
#
# NOTE: `npm publish` runs the prepublishOnly gate (typecheck, lint, format,
# tests) and swaps in the npm README, so a failure part way through still
# leaves the working tree as it was.

set -euo pipefail;

# =========================================================================== #
#                                    Run                                      #
# =========================================================================== #

# -- Must be inside a git work tree -- #
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2;
  exit 1;
fi

# -- Check if logged into npm -- #
if ! NPM_USER="$(npm whoami 2>/dev/null)"; then
  echo "Error: not logged into npm." >&2;
  echo "Run 'npm login' first, then try again." >&2;
  exit 1;
fi
echo "==> Publishing as '${NPM_USER}'";

# -- Refuse to run with uncommitted work -- #
# Switching branches would drag the changes along, and publishing from a dirty
# tree means shipping something that is not in the repo.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: you have uncommitted changes; commit or stash them first." >&2;
  exit 1;
fi

# -- Note the branch currently in -- #
ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)";

# -- Checkout to main if not currently there -- #
# The trap is set before switching so the original branch is restored however
# this exits: a failed publish, a failed gate, or a Ctrl-C part way through.
if [ "$ORIGINAL_BRANCH" != "main" ]; then
  trap 'echo "==> Returning to ${ORIGINAL_BRANCH}"; git checkout "$ORIGINAL_BRANCH"' EXIT;
  echo "==> Switching from '${ORIGINAL_BRANCH}' to 'main'";
  git checkout main;
fi

# -- Make sure main matches the remote -- #
# Publishing from a local main that is behind origin would ship stale code.
echo "==> Pulling latest main";
git pull;

# -- Run npm publish -- #
npm publish;

echo "==> Published.";
