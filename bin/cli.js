#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import insertSeparators, { initConfig } from '../src/insert-separators.js';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const HERE = dirname(fileURLToPath(import.meta.url));
const HELP = readFileSync(join(HERE, 'help.txt'), 'utf8');

// ========================================================================= //
//                                      Run                                  //
// ========================================================================= //

main();

// ========================================================================= //
//                                    Functions                              //
// ========================================================================= //

/**
 * Main
 * @returns
 */
async function main() {
  const args = process.argv.slice(2);

  // -- Print start message -- //
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

  // -- Process command line arguments -- //
  for (const arg of args) {
    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP);
        return;
      case '-v':
      case '--version':
        process.stdout.write(`${readVersion()}\n`);
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

  // -- Run "InsertSeprators" -- //
  let total = 0;
  for (const p of paths) {
    try {
      total += insertSeparators(p, { dryRun }).length;
    } catch (err) {
      process.stderr.write(`seps: ${p}: ${err.message}\n`);
      process.exitCode = 1;
    }
  }

  // -- Print finished message -- //
  const verb = dryRun ? 'would be updated' : 'updated';
  process.stdout.write(
    `seps: ${total} file${total === 1 ? '' : 's'} ${verb}.\n`,
  );
}

/**
 * Look at the package.json and return the version.
 * @returns the package version string
 */
function readVersion() {
  const pkg = JSON.parse(
    readFileSync(join(HERE, '..', 'package.json'), 'utf8'),
  );
  return pkg.version;
}
