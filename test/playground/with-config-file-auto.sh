#!/usr/bin/env bash
set -euo pipefail;

# Create a temp folder to preserve the originals
rm -rf with-config-file.tmp/;
cp -R with-config-file/. with-config-file.tmp/;

cd with-config-file.tmp/;
npx ../../../;
