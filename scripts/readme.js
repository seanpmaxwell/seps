// Swap the published README around publishing. "swap" backs up README.md to
// README-tmp and puts README-npm in its place (so the npm-specific README is
// what gets packed); "restore" puts the original back and removes the backup.

import { copyFileSync, existsSync, rmSync } from 'fs';

const action = process.argv[2];

if (action === 'swap') {
  if (!existsSync('README-npm')) {
    throw new Error('README-npm not found; cannot swap README for publishing');
  }
  copyFileSync('README.md', 'README-tmp');
  copyFileSync('README-npm', 'README.md');
  console.log('README swapped (original backed up to README-tmp)');
} else if (action === 'restore') {
  if (!existsSync('README-tmp')) {
    console.log('README-tmp not found; nothing to restore');
  } else {
    copyFileSync('README-tmp', 'README.md');
    rmSync('README-tmp');
    console.log('README restored from README-tmp');
  }
} else {
  throw new Error(`unknown action "${action}"; use "swap" or "restore"`);
}
