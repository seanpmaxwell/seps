#!/usr/bin/env bash

# `readme.sh` — swap the published README around publishing.
#
# "swap" backs up README.md to README-tmp and puts README-npm in its place (so
# the npm-specific README is what gets packed); "restore" puts the original
# back and removes the backup.
#
# Usage: ./readme.sh swap | ./readme.sh restore

set -euo pipefail;

# =========================================================================== #
#                                    Run                                      #
# =========================================================================== #

ACTION="${1:-}";

if [ "$ACTION" = "swap" ]; then
  if [ ! -f README-npm ]; then
    echo "README-npm not found; cannot swap README for publishing" >&2;
    exit 1;
  fi
  cp README.md README-tmp;
  cp README-npm README.md;
  echo "README swapped (original backed up to README-tmp)";
elif [ "$ACTION" = "restore" ]; then
  if [ ! -f README-tmp ]; then
    echo "README-tmp not found; nothing to restore";
  else
    cp README-tmp README.md;
    rm README-tmp;
    echo "README restored from README-tmp";
  fi
else
  echo "unknown action \"${ACTION}\"; use \"swap\" or \"restore\"" >&2;
  exit 1;
fi
