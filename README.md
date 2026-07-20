# seps

Format separator / header comment markers in your source files so labels are
centered and every line is a fixed width.

## Usage

```bash
npx seps [options] [paths...]
```

If no paths are given, the current directory is walked recursively (skipping
`node_modules` and dotfiles).

### Options

| Option            | Description                                      |
| ----------------- | ------------------------------------------------ |
| `-n`, `--dry-run` | Show what would change without writing files.    |
| `-h`, `--help`    | Show help.                                       |
| `-v`, `--version` | Show the version.                                |

## Markers

Write a marker on its own line and `seps` rewrites it in place:

| Marker           | Result                                        |
| ---------------- | --------------------------------------------- |
| `// r~~ Label`   | **Region** — a 3-line boxed header block.     |
| `// s~~ Label`   | **Section** — a single centered header line.  |

For example, this:

```js
// r~~ Functions
```

becomes:

```js
// ================================================================================================================= //
//                                                     Functions                                                     //
// ================================================================================================================= //
```

Supported files: `.js` `.jsx` `.ts` `.tsx` `.mjs` `.java`

## Programmatic use

```js
import { insertSeparators, formatHeaders, PaddingParams } from 'seps';

insertSeparators('src', { dryRun: true });
```

## License

MIT
