#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import insertSeparators from '../lib/insertSeparators.js';
import initializeDirectory from '../lib/initializeDirectory.js';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

// PWD => "Present working directory"
const PWD = dirname(fileURLToPath(import.meta.url));

// What to print to the console for the `--help` command line argument.
const HELP_ARG_CONTENT = (() => {
  const helpContentFilePath = join(PWD, 'help.txt');
  return readFileSync(helpContentFilePath, 'utf8');
})();

// ========================================================================= //
//                                      Run                                  //
// ========================================================================= //

main();

// ========================================================================= //
//                                    Functions                              //
// ========================================================================= //

/**
 * Start here
 *
 * @returns {void}
 */
function main() {
  // `init` option generates a default config file instead of
  // "inserting separators"
  const args = process.argv.slice(2);
  if (args[0] === 'init') {
    try {
      const filePath = initializeDirectory();
      process.stdout.write(`seps: created ${filePath}\n`);
    } catch (err) {
      process.stderr.write(`seps: ${err.message}\n`);
      process.exitCode = 1;
    }
    return;
  }
  // Process other command line arguments (besides `init`)
  const { paths, dryRun } = processCommandLineArgs(args);
  // Run insertSeparators()
  let total = 0;
  for (const p of paths) {
    try {
      const filesChanged = insertSeparators(p, { dryRun });
      total += filesChanged.length;
    } catch (err) {
      process.stderr.write(`seps: ${p}: ${err.message}\n`);
      process.exitCode = 1;
    }
  }
  // Print finished message
  const verb = dryRun ? 'would be updated' : 'updated';
  const message = `seps: ${total} file${total === 1 ? '' : 's'} ${verb}.\n`;
  process.stdout.write(message);
}

/**
 * Process the command-line arguments. If running insertSeparators, return an
 * object with an array of paths (strings) and whether to do a dry-run, if not
 * return `null`.
 *
 * @param {string[]} args
 * @returns {object | null}
 */
function processCommandLineArgs(args) {
  // Init retVal
  const retVal = {
    paths: [],
    dryRun: false,
  };
  // Process other command line arguments (besides init)
  for (const arg of args) {
    switch (arg) {
      case '-h':
      case '--help':
        process.stdout.write(HELP_ARG_CONTENT);
        return null;
      case '-v':
      case '--version':
        process.stdout.write(`${readVersion()}\n`);
        return null;
      case '-n':
      case '--dry-run':
        retVal.dryRun = true;
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
  // If no paths, use the current directory.
  if (retVal.paths.length === 0) {
    retVal.paths.push('.');
  }
  // Return
  return retVal;
}

/**
 * Look at the package.json and return the version.
 *
 * @returns {string}
 */
function readVersion() {
  const filePath = join(PWD, '..', 'package.json');
  const fileContent = readFileSync(filePath, 'utf8');
  return JSON.parse(fileContent).version;
}
