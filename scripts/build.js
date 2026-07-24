import { build } from 'esbuild';
import { mkdirSync, copyFileSync, rmSync } from 'fs';

// ========================================================================= //
//                                      Run                                  //
// ========================================================================= //
// Build step: minify the JS under src/ and copy the JSON alongside it into
// lib/, which is what the published package points at. src/ stays the readable
// dev source; lib/ is generated and git-ignored.

rmSync('lib', { recursive: true, force: true });
mkdirSync('lib', { recursive: true });

await build({
  entryPoints: ['src/index.js'],
  outfile: 'lib/index.js',
  minify: true,
  format: 'esm',
  platform: 'node',
});

console.log('Built lib/');
