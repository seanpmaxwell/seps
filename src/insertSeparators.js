import fs from 'fs';
import path from 'path';
import DefaultConfig from './common/DefaultConfig';
import { CONFIG_FILE_NAME } from './common/constants';
import loadJsonFile from './common/utils/loadJsonFile';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

// Marker tokens written in source files: "// @reg Label", "/* @sec Label */".
// These are fixed and not configurable.
const Markers = {
  REGION: '@reg',
  SECTION: '@sec',
};

const ConfigErrorMessages = {
  Extensions(lang) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" needs an Extensions array`;
  },
  CommentPair(lang) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" needs a Comment pair, e.g. ["# ", ""]`;
  },
  CharacterLimit(lang) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" CharacterLimit must be a positive integer, e.g. 79`;
  },
  FillerCharacter(lang) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" FillerCharacter must be a single character, e.g. "="`;
  },
  DisableCapitalization(lang) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" DisableCapitalization must be true or false`;
  },
};

const DefaultOptions = {
  dryRun: false,
  printLog: value => console.log(value),
  printWarn: value => console.warn(value),
};

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 *
 * @param {string} targetPath
 * @param {object} options
 * @returns {string[]}
 */
function insertSeparators(targetPath, options = DefaultOptions) {
  const dirPath = configDirFor(targetPath);
  const { All, ...languages } = loadConfig(dirPath, options.printLog);
  const languagesEntries = Object.entries(languages);
  const langConfigArr = languagesEntries.map(([lang, entry]) =>
    compileEntry(lang, entry, All),
  );
  return walk(targetPath, langConfigArr, options);
}

// =========================== Private Helpers ============================= //

/**
 * @private
 * Resolve the effective config: DefaultConfig, overridden per-language by any
 * seps-config.json found in the config directory. Unknown language keys in the
 * JSON define new languages.
 *
 * @param {string} cwd
 * @param {function} printLog
 * @returns {object}
 */
function loadConfig(cwd, printLog) {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  if (!fs.existsSync(configPath)) {
    return DefaultConfig;
  }
  // Load overrides from config file
  let overrides;
  try {
    overrides = loadJsonFile(configPath);
  } catch (err) {
    const message = `invalid ${CONFIG_FILE_NAME}: ${err.message}`;
    throw new Error(message, { cause: err });
  }
  // "All" holds settings shared by every language (CharacterLimit,
  // FillerCharacter); per-language values still win over them. Every other
  // key is a language.
  const { All: allOverrides, ...langOverrides } = overrides;
  const config = { All: { ...DefaultConfig.All, ...allOverrides } };
  const defaultLangs = Object.keys(DefaultConfig).filter(key => key !== 'All');
  const set = new Set([...defaultLangs, ...Object.keys(langOverrides)]);
  for (const lang of set) {
    config[lang] = { ...DefaultConfig[lang], ...langOverrides[lang] };
  }
  printLog(`Using config overrides from: ${configPath}`);
  // Rreturn
  return config;
}

/**
 * @private
 * Directory whose seps-config.json applies to a target path: the target's own
 * directory if it has one, otherwise the directory seps is being run from.
 *
 * @param {string} targetPath
 * @returns {string}
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
 * @private
 * Compile a declarative language entry into the matchers used while walking:
 * a FILE_EXT regex and REGION/SECTION marker regexes built from the comment
 * syntax around the fixed marker tokens. CharacterLimit/FillerCharacter fall
 * back to the shared "All" settings.
 *
 * @param {string} lang
 * @param {object} entry
 * @param {object} all
 * @returns {object}
 */
function compileEntry(lang, entry, all) {
  const {
    Extensions,
    Comment,
    CharacterLimit,
    FillerCharacter,
    DisableCapitalization,
    Bookends,
  } = entry;
  // Check the configuration for errors
  if (!Array.isArray(Extensions) || Extensions.length === 0) {
    const message = ConfigErrorMessages.Extensions(lang);
    throw new Error(message);
  }
  const [open, close] = Array.isArray(Comment) ? Comment : [];
  if (typeof open !== 'string' || typeof close !== 'string') {
    const message = ConfigErrorMessages.CommentPair(lang);
    throw new Error(message);
  }
  const charLimit = CharacterLimit ?? all.CharacterLimit;
  if (!Number.isInteger(charLimit) || charLimit < 1) {
    const message = ConfigErrorMessages.CharacterLimit(lang);
    throw new Error(message);
  }
  const fillerChar = FillerCharacter ?? all.FillerCharacter;
  if (typeof fillerChar !== 'string' || fillerChar.length !== 1) {
    const message = ConfigErrorMessages.FillerCharacter(lang);
    throw new Error(message);
  }
  const disableCap =
    DisableCapitalization ?? all.DisableCapitalization ?? false;
  if (typeof disableCap !== 'boolean') {
    const message = ConfigErrorMessages.DisableCapitalization(lang);
    throw new Error(message);
  }
  // Capture the label if present. A bare marker ("// @reg" with no label) still
  // matches, but is warned about and skipped rather than formatted.
  const marker = token =>
    new RegExp(
      `^\\s*${escapeRegex(open)}${escapeRegex(token)}(?: (.+?))?${escapeRegex(close)}\\s*$`,
    );
  const exts = Extensions.map(ext => escapeRegex(ext.replace(/^\./, '')));
  // Return
  return {
    FILE_EXT: new RegExp(`\\.(${exts.join('|')})$`),
    REGION_MARKER: marker(Markers.REGION),
    SECTION_MARKER: marker(Markers.SECTION),
    BOOKENDS: Bookends ?? (close ? [open, close] : [open, ` ${open.trim()}`]),
    CHAR_LIMIT: charLimit,
    FILLER: fillerChar,
    DISABLE_CAP: disableCap,
  };
}

/**
 * @private
 * Escape regex special characters in a literal string.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @private
 * Recursively walk a path, rewriting markers in every supported file.
 *
 * @param {string} targetPath
 * @param {object[]} langConfigArr
 * @param {object} options
 * @returns {string[]}
 */
function walk(targetPath, langConfigArr, options) {
  const updated = [];
  const stat = fs.statSync(targetPath);
  // Go recursive if directory
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const fileFullPath = path.join(targetPath, entry.name);
      const result = walk(fileFullPath, langConfigArr, options);
      updated.push(...result);
    }
    return updated;
  }
  // Check the patting type
  const paddingType =
    langConfigArr.find(type => type.FILE_EXT.test(targetPath)) ?? null;
  if (!paddingType) return updated;
  // Write the separator comment
  const content = fs.readFileSync(targetPath, 'utf8');
  const next = formatSeparators(
    content,
    paddingType,
    targetPath,
    options.printWarn,
  );
  if (next !== content) {
    if (!options.dryRun) {
      fs.writeFileSync(targetPath, next, 'utf8');
    }
    options.printLog(
      `${options.dryRun ? 'Would update' : 'Updated'}: ${targetPath}`,
    );
    updated.push(targetPath);
  }
  // Return
  return updated;
}

/**
 * @private
 * Determine whether to format a "section" or a "region".
 *
 * @param {string} text
 * @param {object[]} paddingType
 * @param {string} filePath
 * @param {function} printWarn
 * @returns {string}
 */
function formatSeparators(text, paddingType, filePath, printWarn) {
  return text
    .split('\n')
    .map((line, index) => {
      const indent = line.match(/^(\s*)/)[1];
      const sectionMatch = line.match(paddingType.SECTION_MARKER);
      // Insert "section" separator
      if (sectionMatch) {
        const label = sectionMatch[1]?.trim() ?? '';
        if (!label) return warnNoLabel(line, filePath, index, printWarn);
        return formatSection(
          capitalizeLabel(label, paddingType),
          paddingType,
          indent,
        );
      }
      // Insert "region" separator
      const regionMatch = line.match(paddingType.REGION_MARKER);
      if (regionMatch) {
        const label = regionMatch[1]?.trim() ?? '';
        if (!label) return warnNoLabel(line, filePath, index, printWarn);
        return formatRegion(
          capitalizeLabel(label, paddingType),
          paddingType,
          indent,
        );
      }
      return line;
    })
    .join('\n');
}

/**
 * @private
 * Warn that a marker on the given (0-based) line has no label, and return the
 * line unchanged so nothing is inserted.
 *
 * @param {*} line
 * @param {*} filePath
 * @param {*} index
 * @param {*} printWarn
 * @returns
 */
function warnNoLabel(line, filePath, index, printWarn) {
  const message =
    `Warning: ${filePath}:${index + 1}: separator marker has ` +
    'no label, skipping';
  printWarn(message);
  return line;
}

/**
 * @private
 * Capitalize each word in a label (first letter upper, rest lower), unless the
 * language has DisableCapitalization set. Words that start or end with a
 * non-alphanumeric character are left untouched (e.g. "@decorator", "foo()").
 *
 * @param {*} label
 * @param {*} paddingType
 * @returns
 */
function capitalizeLabel(label, paddingType) {
  if (paddingType.DISABLE_CAP) return label;
  return label
    .split(/\s+/)
    .map(word => {
      const isAlnum = ch => /[a-z0-9]/i.test(ch);
      if (!isAlnum(word[0]) || !isAlnum(word[word.length - 1])) return word;
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * @private
 * Build a single-line section header centered within `[open] = label = [close]`.
 * Filler fills up to the character limit and stops; a label too long to fit
 * simply gets no filler rather than pushing the line past the limit.
 *
 * @param {*} label
 * @param {*} paddingType
 * @param {*} indent
 * @returns
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
 * @private
 * Build a 3-line region header block with the label centered on the middle line.
 * Rule lines stop at the character limit: "// " + filler + " //".
 *
 * @param {*} label
 * @param {*} paddingType
 * @param {*} indent
 * @returns
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
