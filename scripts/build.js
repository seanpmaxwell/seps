// Build step: minify the JS under src/ and copy the JSON alongside it into
// lib/, which is what the published package points at. src/ stays the readable
// dev source; lib/ is generated and git-ignored.

import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'fs';

mkdirSync('lib', { recursive: true });

await build({
  entryPoints: ['src/insert-separators.js'],
  outfile: 'lib/insert-separators.js',
  minify: true,
  format: 'esm',
  platform: 'node',
});

// insert-separators.js reads DefaultConfig.json from next to itself at runtime,
// so it must sit beside the built module.
copyFileSync('src/DefaultConfig.json', 'lib/DefaultConfig.json');

console.log('Built lib/');
