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

| Option            | Description                                   |
| ----------------- | --------------------------------------------- |
| `-n`, `--dry-run` | Show what would change without writing files. |
| `-h`, `--help`    | Show help.                                    |
| `-v`, `--version` | Show the version.                             |

## Markers

Write a marker on its own line and `seps` rewrites it in place:

| Marker          | Result                                       |
| --------------- | -------------------------------------------- |
| `// @reg Label` | **Region** — a 3-line boxed header block.    |
| `// @sec Label` | **Section** — a single centered header line. |

For example, this:

```js
// @reg Functions
```

becomes:

```js
// ========================================================================= //
//                                 Functions                                 //
// ========================================================================= //
```

Supported files: `.js` `.jsx` `.ts` `.tsx` `.mjs` `.cjs` `.java` `.css`
`.scss` — and any others you add via configuration.

## Configuration

`seps` works out of the box — you only need a config file if you want to
override the default settings.

To do so, add a `seps-config.json`. `seps` looks for it in the target path's
directory first, then falls back to the directory it is run from (nearest wins
— the two are not merged). Any values in it override the corresponding
defaults; everything else keeps its default.

The `All` key holds settings shared by every language. Every other top-level
key is a language — unknown keys define new languages.

| `All` field       | Meaning                                                            |
| ----------------- | ------------------------------------------------------------------ |
| `Markers`         | `[region, section]` marker tokens. Defaults to `["@reg", "@sec"]`. |
| `TotalLength`     | Width of generated header lines in characters. Defaults to `79`.   |
| `FillerCharacter` | Character the header lines are padded with. Defaults to `"="`.     |

Each language entry declares how comments are written — `seps` builds the
marker matching itself, no regexes needed:

| Language field    | Meaning                                                                         |
| ----------------- | ------------------------------------------------------------------------------- |
| `Extensions`      | File extensions to match, e.g. `["py"]`.                                        |
| `Comment`         | Comment open/close the markers are written in; close is `""` for line comments. |
| `Bookends`        | Optional. Start/end of generated header lines. Defaults to the comment syntax.  |
| `Markers`         | Optional. Overrides `All.Markers` for this language.                            |
| `TotalLength`     | Optional. Overrides `All.TotalLength` for this language.                        |
| `FillerCharacter` | Optional. Overrides `All.FillerCharacter` for this language.                    |

```json
{
  "All": {
    "Markers": ["@region", "@section"],
    "TotalLength": 100,
    "FillerCharacter": "-"
  },
  "Java": {
    "Bookends": ["/* ", " */"]
  },
  "Python": {
    "Extensions": ["py"],
    "Comment": ["# ", ""]
  }
}
```

With that config, `# @region Label` in a `.py` file becomes a `# ---- #` boxed
header block 100 characters wide.

Built-in languages and their defaults:

| Key    | Files                         | Markers written as | Bookends      |
| ------ | ----------------------------- | ------------------ | ------------- |
| `Js`   | `.js .jsx .ts .tsx .mjs .cjs` | `// @reg Label`    | `// ` … ` //` |
| `Java` | `.java`                       | `/* @reg Label */` | `// ` … ` //` |
| `Css`  | `.css .scss`                  | `/* @reg Label */` | `/* ` … ` */` |

Rather than writing the file from scratch, you can generate one pre-filled
with all the default settings and edit from there:

```bash
npx seps init
```

This writes a `seps-config.json` to the current directory (it refuses to
overwrite an existing one).

## Programmatic use

```js
import insertSeparators from 'seps';

insertSeparators('src', { dryRun: true });
```

## License

MIT
