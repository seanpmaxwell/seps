import fs from 'fs';
import path from 'path';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const CONFIG_FILE_NAME = 'seps-config.json';

// Marker tokens written in source files: "// @reg Label", "/* @sec Label */".
// These are fixed and not configurable.
const REGION_TOKEN = '@reg';
const SECTION_TOKEN = '@sec';

// Each language declares its file extensions, the comment syntax markers are
// written in (open/close, close empty for line comments), and the bookends
// used for the generated header lines (defaults to the comment syntax). The
// marker regexes are built from these — no regexes in config files.
const DefaultConfig = {
  All: {
    CharacterLimit: 79,
    FillerCharacter: '=',
  },
  Js: {
    Extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    Comment: ['// ', ''],
    Bookends: ['// ', ' //'],
  },
  Java: {
    Extensions: ['java'],
    Comment: ['// ', ''],
    Bookends: ['// ', ' //'],
  },
  Css: {
    Extensions: ['css', 'scss'],
    Comment: ['/* ', ' */'],
    Bookends: ['/* ', ' */'],
  },
};

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 */
function insertSeparators(
  targetPath,
  { dryRun = false, log = console.log, warn = console.warn } = {},
) {
  const { All, ...languages } = loadConfig(configDirFor(targetPath), log);
  const paddingTypes = Object.entries(languages).map(([lang, entry]) =>
    compileEntry(lang, entry, All),
  );
  return walk(targetPath, paddingTypes, { dryRun, log, warn });
}

/**
 * Generate a seps-config.json in the given directory (default: the directory
 * seps is being run from) containing all the default settings. Refuses to
 * overwrite an existing config. Returns the path of the written file.
 */
function initConfig(dir = process.cwd()) {
  const configPath = path.join(dir, CONFIG_FILE_NAME);
  if (fs.existsSync(configPath)) {
    throw new Error(`${CONFIG_FILE_NAME} already exists here, not overwriting`);
  }
  fs.writeFileSync(configPath, `${stringifyConfig(DefaultConfig)}\n`, 'utf8');
  return configPath;
}

/**
 * Serialize a config object like JSON.stringify(value, null, 2), but keep
 * arrays on a single line (e.g. "Markers": ["@reg", "@sec"]) instead of one
 * element per line. Config arrays only ever hold primitives.
 */
function stringifyConfig(value, indent = '') {
  if (Array.isArray(value)) {
    return `[${value.map(item => JSON.stringify(item)).join(', ')}]`;
  }
  if (value && typeof value === 'object') {
    const inner = `${indent}  `;
    const entries = Object.entries(value).map(
      ([key, val]) =>
        `${inner}${JSON.stringify(key)}: ${stringifyConfig(val, inner)}`,
    );
    return `{\n${entries.join(',\n')}\n${indent}}`;
  }
  return JSON.stringify(value);
}

/**
 * Directory whose seps-config.json applies to a target path: the target's own
 * directory if it has one, otherwise the directory seps is being run from.
 */
function configDirFor(targetPath) {
  const targetDir = fs.statSync(targetPath).isDirectory()
    ? targetPath
    : path.dirname(targetPath);
  return fs.existsSync(path.join(targetDir, CONFIG_FILE_NAME))
    ? targetDir
    : process.cwd();
}

/**
 * Resolve the effective config: DefaultConfig, overridden per-language by any
 * seps-config.json found in the config directory. Unknown language keys in the
 * JSON define new languages.
 */
function loadConfig(cwd, log = console.log) {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  if (!fs.existsSync(configPath)) return DefaultConfig;
  //
  let overrides;
  try {
    overrides = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`invalid ${CONFIG_FILE_NAME}: ${err.message}`, {
      cause: err,
    });
  }
  // "All" holds settings shared by every language (CharacterLimit,
  // FillerCharacter); per-language values still win over them. Every other
  // key is a language.
  const { All: allOverrides, ...langOverrides } = overrides;
  const config = { All: { ...DefaultConfig.All, ...allOverrides } };
  const defaultLangs = Object.keys(DefaultConfig).filter(key => key !== 'All');
  for (const lang of new Set([
    ...defaultLangs,
    ...Object.keys(langOverrides),
  ])) {
    config[lang] = { ...DefaultConfig[lang], ...langOverrides[lang] };
  }
  if (log) log(`Using config overrides from: ${configPath}`);
  return config;
}

/**
 * Compile a declarative language entry into the matchers used while walking:
 * a FILE_EXT regex and REGION/SECTION marker regexes built from the comment
 * syntax around the fixed marker tokens. CharacterLimit/FillerCharacter fall
 * back to the shared "All" settings.
 */
function compileEntry(lang, entry, all) {
  const { Extensions, Comment, Bookends, CharacterLimit, FillerCharacter } =
    entry;
  if (!Array.isArray(Extensions) || Extensions.length === 0) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" needs an Extensions array, e.g. ["py"]`,
    );
  }
  const [open, close] = Array.isArray(Comment) ? Comment : [];
  if (typeof open !== 'string' || typeof close !== 'string') {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" needs a Comment pair, e.g. ["# ", ""]`,
    );
  }
  const charLimit = CharacterLimit ?? all.CharacterLimit;
  if (!Number.isInteger(charLimit) || charLimit < 1) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" CharacterLimit must be a positive integer, e.g. 79`,
    );
  }
  const filler = FillerCharacter ?? all.FillerCharacter;
  if (typeof filler !== 'string' || filler.length !== 1) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" FillerCharacter must be a single character, e.g. "="`,
    );
  }
  //
  const exts = Extensions.map(ext => escapeRegex(ext.replace(/^\./, '')));
  // Capture the label if present. A bare marker ("// @reg" with no label) still
  // matches, but is warned about and skipped rather than formatted.
  const marker = token =>
    new RegExp(
      `^\\s*${escapeRegex(open)}${escapeRegex(token)}(?: (.+?))?${escapeRegex(close)}\\s*$`,
    );
  //
  return {
    FILE_EXT: new RegExp(`\\.(${exts.join('|')})$`),
    REGION_MARKER: marker(REGION_TOKEN),
    SECTION_MARKER: marker(SECTION_TOKEN),
    BOOKENDS: Bookends ?? (close ? [open, close] : [open, ` ${open.trim()}`]),
    CHAR_LIMIT: charLimit,
    FILLER: filler,
  };
}

/**
 * Escape regex special characters in a literal string.
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recursively walk a path, rewriting markers in every supported file.
 */
function walk(targetPath, paddingTypes, { dryRun, log, warn }) {
  const updated = [];
  const stat = fs.statSync(targetPath);
  // Go recursive if directory
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      updated.push(
        ...walk(path.join(targetPath, entry.name), paddingTypes, {
          dryRun,
          log,
          warn,
        }),
      );
    }
    return updated;
  }
  // Check the patting type
  const paddingType =
    paddingTypes.find(type => type.FILE_EXT.test(targetPath)) ?? null;
  if (!paddingType) return updated;
  // Write the separator comment
  const content = fs.readFileSync(targetPath, 'utf8');
  const next = formatSeparators(content, paddingType, targetPath, warn);
  if (next !== content) {
    if (!dryRun) fs.writeFileSync(targetPath, next, 'utf8');
    if (log) log(`${dryRun ? 'Would update' : 'Updated'}: ${targetPath}`);
    updated.push(targetPath);
  }
  // Return
  return updated;
}

/**
 * Format header markers so the label is centered and the result stops at (never
 * exceeds) the character limit. Two kinds are supported:
 *
 * Region ("// @reg someText") -> a 3-line block:
 *
 * // ====================================================================== //
 * //                                  someText                              //
 * // ====================================================================== //
 *
 * Section ("// @sec someText") -> a single line:
 *
 * // ==================== someText ===================== //
 */
function formatSeparators(text, paddingType, filePath, warn = console.warn) {
  return text
    .split('\n')
    .map((line, index) => {
      const indent = line.match(/^(\s*)/)[1];
      const sectionMatch = line.match(paddingType.SECTION_MARKER);
      if (sectionMatch) {
        const label = sectionMatch[1]?.trim() ?? '';
        if (!label) return warnNoLabel(line, filePath, index, warn);
        return formatSection(label, paddingType, indent);
      }
      const regionMatch = line.match(paddingType.REGION_MARKER);
      if (regionMatch) {
        const label = regionMatch[1]?.trim() ?? '';
        if (!label) return warnNoLabel(line, filePath, index, warn);
        return formatRegion(label, paddingType, indent);
      }
      return line;
    })
    .join('\n');
}

/**
 * Warn that a marker on the given (0-based) line has no label, and return the
 * line unchanged so nothing is inserted.
 */
function warnNoLabel(line, filePath, index, warn) {
  warn(
    `Warning: ${filePath}:${index + 1}: separator marker has no label, skipping`,
  );
  return line;
}

/**
 * Build a single-line section header centered within `[open] = label = [close]`.
 * Filler fills up to the character limit and stops; a label too long to fit
 * simply gets no filler rather than pushing the line past the limit.
 */
function formatSection(label, paddingType, indent) {
  const [open, close] = paddingType.BOOKENDS;
  const filler = paddingType.FILLER;
  const lineLen = paddingType.CHAR_LIMIT - indent.length;
  const available = lineLen - open.length - close.length - label.length - 2;
  const left = Math.max(Math.ceil(available / 2), 0);
  const right = Math.max(Math.floor(available / 2), 0);
  return `${indent}${open}${filler.repeat(left)} ${label} ${filler.repeat(right)}${close}`;
}

/**
 * Build a 3-line region header block with the label centered on the middle line.
 * Rule lines stop at the character limit: "// " + filler + " //".
 */
function formatRegion(label, paddingType, indent) {
  const [open, close] = paddingType.BOOKENDS;
  const lineLen = paddingType.CHAR_LIMIT - indent.length;
  const inner = Math.max(lineLen - open.length - close.length, 0);
  const rule = indent + open + paddingType.FILLER.repeat(inner) + close;
  const leftPad = Math.max(Math.floor((inner - label.length) / 2), 0);
  const rightPad = Math.max(inner - label.length - leftPad, 0);
  const middle =
    indent + open + ' '.repeat(leftPad) + label + ' '.repeat(rightPad) + close;
  return [rule, middle, rule].join('\n');
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default insertSeparators;
export { initConfig };
