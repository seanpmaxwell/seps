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

## Configuration

`seps` looks for a `seps-config.json` file in the target path's directory
first, then falls back to the directory it is run from (nearest wins — the two
are not merged). Any values in it override the corresponding values in the
built-in `DefaultConfig`; everything else keeps its default. Unknown top-level
keys define new languages.

Each language entry declares how comments are written — `seps` builds the
marker matching around `r~~` / `s~~` itself, no regexes needed:

| Field        | Meaning                                                                              |
| ------------ | ------------------------------------------------------------------------------------ |
| `EXTENSIONS` | File extensions to match, e.g. `["py"]`.                                             |
| `COMMENT`    | Comment open/close the markers are written in; close is `""` for line comments.      |
| `BOOKENDS`   | Optional. Start/end of generated header lines. Defaults to the comment syntax.       |
| `MARKERS`    | Optional. `[region, section]` marker tokens. Defaults to `["r~~", "s~~"]`.           |
| `TOTAL_LEN`  | Optional. Width of generated header lines in characters. Defaults to `119`.          |

`MARKERS` and `TOTAL_LEN` can also be set at the top level of the config to
apply to every language at once (per-language values still win over them):

```json
{
  "MARKERS": ["@region", "@section"],
  "TOTAL_LEN": 100,
  "Java": {
    "BOOKENDS": ["/* ", " */"]
  },
  "Python": {
    "EXTENSIONS": ["py"],
    "COMMENT": ["# ", ""]
  }
}
```

With that config, `# r~~ Label` in a `.py` file becomes a `# ==== #` boxed
header block.

Built-in languages and their defaults:

| Key    | Files                     | Markers written as  | Bookends       |
| ------ | ------------------------- | ------------------- | -------------- |
| `Js`   | `.js .jsx .ts .tsx .mjs`  | `// r~~ Label`      | `// ` … ` //`  |
| `Java` | `.java`                   | `/* r~~ Label */`   | `// ` … ` //`  |
| `Css`  | `.css .scss`              | `/* r~~ Label */`   | `/* ` … ` */`  |

## Programmatic use

```js
import insertSeparators from 'seps';

insertSeparators('src', { dryRun: true });
```

## License

MIT
