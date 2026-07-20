#!/usr/bin/env node
/* eslint-disable no-undef */

import insertSeparators, { initConfig } from '../src/insert-separators.js';

const HELP = `seps - format separator/header comment markers

  Usage:
    seps [options] [paths...]
    seps init

  Commands:
    init             Generate a seps-config.json in the current directory
                    containing all the default settings.

  Arguments:
    paths            Files or directories to process (default: current directory).
                    Directories are walked recursively, skipping node_modules
                    and dotfiles.

  Options:
    -n, --dry-run    Show what would change without writing any files.
    -h, --help       Show this help.
    -v, --version    Show the version.

  Markers (rewritten in place, centered to a fixed width):
    "// @reg Label"  Region  -> a 3-line boxed header block.
    "// @sec Label"  Section -> a single centered header line.

  Supported files: .js .jsx .ts .tsx .mjs .java (more via seps-config.json)
`;

main();

/**
 * Main
 * @returns 
 */
async function main() {
  const args = process.argv.slice(2);
  // "seps init" generates a default config file instead of processing paths
  if (args[0] === 'init') {
    try {
      process.stdout.write(`seps: created ${initConfig()}\n`);
    } catch (err) {
      process.stderr.write(`seps: ${err.message}\n`);
      process.exitCode = 1;
    }
    return;
  }
  const paths = [];
  let dryRun = false;
  // Process command line arguments
  for (const arg of args) {
    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        return;
      case '-v':
      case '--version':
        process.stdout.write(`${await readVersion()}\n`);
        return;
      case '-n':
      case '--dry-run':
        dryRun = true;
        break;
      default:
        if (arg.startsWith('-')) {
          process.stderr.write(`seps: unknown option '${arg}'\n`);
          process.exitCode = 1;
          return;
        }
        paths.push(arg);
    }
  }
  if (paths.length === 0) paths.push('.');
  //
  let total = 0;
  for (const p of paths) {
    try {
      total += insertSeparators(p, { dryRun }).length;
    } catch (err) {
      process.stderr.write(`seps: ${p}: ${err.message}\n`);
      process.exitCode = 1;
    }
  }
  //
  const verb = dryRun ? 'would be updated' : 'updated';
  process.stdout.write(`seps: ${total} file${total === 1 ? '' : 's'} ${verb}.\n`);
}

/**
 * 
 * @returns 
 */
async function readVersion() {
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  const here = dirname(fileURLToPath(import.meta.url));
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
  return pkg.version;
}
