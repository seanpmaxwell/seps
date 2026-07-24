import { build } from 'esbuild';
import { mkdirSync, rmSync } from 'fs';

// ========================================================================= //
//                                      Run                                  //
// ========================================================================= //
// Build step: bundle and minify src/ from its single entry point into one
// self-contained lib/index.js, which is what the published package points at.
// src/ stays the readable dev source; lib/ is generated and git-ignored.

rmSync('lib', { recursive: true, force: true });
mkdirSync('lib', { recursive: true });

await build({
  entryPoints: ['src/index.js'],
  outfile: 'lib/index.js',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'node',
});

console.log('Built lib/');
