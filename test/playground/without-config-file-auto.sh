#!/usr/bin/env bash
set -euo pipefail;

# Create a temp folder to preserve the originals
rm -rf without-config-file.tmp/;
cp -R without-config-file/. without-config-file.tmp/;

cd without-config-file.tmp/;
npx ../../../;
