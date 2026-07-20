import fs from 'fs';
import path from 'path';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const CONFIG_FILE_NAME = 'seps-config.json';

// Each language declares its file extensions, the comment syntax markers are
// written in (open/close, close empty for line comments), and the bookends
// used for the generated header lines (defaults to the comment syntax). The
// marker regexes are built from these — no regexes in config files.
const DefaultConfig = {
  All: {
    Markers: ['@reg', '@sec'],
    TotalLength: 79,
    FillerCharacter: '=',
  },
  Js: {
    Extensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
    Comment: ['// ', ''],
    Bookends: ['// ', ' //'],
  },
  Java: {
    Extensions: ['java'],
    Comment: ['/* ', ' */'],
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
  { dryRun = false, log = console.log } = {},
) {
  const { All, ...languages } = loadConfig(configDirFor(targetPath), log);
  const paddingTypes = Object.entries(languages).map(([lang, entry]) =>
    compileEntry(lang, entry, All),
  );
  return walk(targetPath, paddingTypes, { dryRun, log });
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
  fs.writeFileSync(
    configPath,
    `${JSON.stringify(DefaultConfig, null, 2)}\n`,
    'utf8',
  );
  return configPath;
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
  // "All" holds settings shared by every language (Markers, TotalLength,
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
 * syntax around the marker tokens. Markers/TotalLength/FillerCharacter fall
 * back to the shared "All" settings.
 */
function compileEntry(lang, entry, all) {
  const {
    Extensions,
    Comment,
    Bookends,
    Markers,
    TotalLength,
    FillerCharacter,
  } = entry;
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
  const [regionToken, sectionToken] = Markers ?? all.Markers ?? [];
  if (
    typeof regionToken !== 'string' ||
    !regionToken ||
    typeof sectionToken !== 'string' ||
    !sectionToken
  ) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" Markers must be a [region, section] pair, e.g. ["@reg", "@sec"]`,
    );
  }
  const totalLen = TotalLength ?? all.TotalLength;
  if (!Number.isInteger(totalLen) || totalLen < 1) {
    throw new Error(
      `invalid ${CONFIG_FILE_NAME}: "${lang}" TotalLength must be a positive integer, e.g. 79`,
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
  const marker = token =>
    new RegExp(
      `^\\s*${escapeRegex(open)}${escapeRegex(token)} (.+?)${escapeRegex(close)}\\s*$`,
    );
  //
  return {
    FILE_EXT: new RegExp(`\\.(${exts.join('|')})$`),
    REGION_MARKER: marker(regionToken),
    SECTION_MARKER: marker(sectionToken),
    BOOKENDS: Bookends ?? (close ? [open, close] : [open, ` ${open.trim()}`]),
    TOTAL_LEN: totalLen,
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
function walk(targetPath, paddingTypes, { dryRun, log }) {
  const updated = [];
  const stat = fs.statSync(targetPath);
  //
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      updated.push(
        ...walk(path.join(targetPath, entry.name), paddingTypes, {
          dryRun,
          log,
        }),
      );
    }
    return updated;
  }
  //
  const paddingType =
    paddingTypes.find(type => type.FILE_EXT.test(targetPath)) ?? null;
  if (!paddingType) return updated;
  //
  const content = fs.readFileSync(targetPath, 'utf8');
  const next = formatHeaders(content, paddingType);
  if (next !== content) {
    if (!dryRun) fs.writeFileSync(targetPath, next, 'utf8');
    if (log) log(`${dryRun ? 'Would update' : 'Updated'}: ${targetPath}`);
    updated.push(targetPath);
  }
  return updated;
}

/**
 * Format header markers so the label is centered and the result is exactly
 * {TOTAL_LEN} characters wide. Two kinds are supported:
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
function formatHeaders(text, paddingType) {
  return text
    .split('\n')
    .map(line => {
      const indent = line.match(/^(\s*)/)[1];
      const sectionMatch = line.match(paddingType.SECTION_MARKER);
      if (sectionMatch) {
        return formatSection(
          sectionMatch[1]?.trim() ?? '',
          paddingType,
          indent,
        );
      }
      const regionMatch = line.match(paddingType.REGION_MARKER);
      if (regionMatch) {
        return formatRegion(regionMatch[1]?.trim() ?? '', paddingType, indent);
      }
      return line;
    })
    .join('\n');
}

/**
 * Build a single-line section header centered within `[open] = label = [close]`.
 */
function formatSection(label, paddingType, indent) {
  const [open, close] = paddingType.BOOKENDS;
  const filler = paddingType.FILLER;
  const lineLen = paddingType.TOTAL_LEN - indent.length;
  const available = lineLen - open.length - close.length - label.length - 2;
  const left = Math.max(Math.ceil(available / 2), 0);
  const right = Math.max(Math.floor(available / 2), 0);
  return `${indent}${open}${filler.repeat(left)} ${label} ${filler.repeat(right)}${close}`;
}

/**
 * Build a 3-line region header block with the label centered on the middle line.
 * Each line is exactly {TOTAL_LEN} characters: "// " + content + " //"
 */
function formatRegion(label, paddingType, indent) {
  const [open, close] = paddingType.BOOKENDS;
  const lineLen = paddingType.TOTAL_LEN - indent.length;
  const inner = lineLen - open.length - close.length;
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
