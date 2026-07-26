import { build } from 'esbuild';
import { execFileSync } from 'child_process';
import { mkdirSync, rmSync } from 'fs';

// ========================================================================= //
//                                      Run                                  //
// ========================================================================= //
// Build step: compile src/ with TypeScript first, then bundle and minify it
// from its single entry point into one self-contained lib/index.js, which is
// what the published package points at. src/ stays the readable dev source;
// lib/ is generated and git-ignored.
//
// TypeScript has to run first because esbuild only strips types, it never
// checks them. Compiling up front means a type error aborts the build before
// any bundle is written, rather than leaving a broken lib/ behind.

rmSync('lib', { recursive: true, force: true });
mkdirSync('lib', { recursive: true });

// Typecheck src/ and emit the .d.ts files consumers use. tsc prints its own
// errors, so on failure just exit with its status rather than dumping a Node
// stack trace on top of them.
try {
  execFileSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.build.json'],
    { stdio: 'inherit' },
  );
} catch {
  rmSync('lib', { recursive: true, force: true });
  process.exit(1);
}

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  minify: true,
  format: 'esm',
  platform: 'node',
});

console.log('Built lib/');
