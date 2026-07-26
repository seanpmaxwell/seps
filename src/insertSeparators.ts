import fs from 'fs';
import path from 'path';
import DefaultConfig from './common/DefaultConfig';
import { CONFIG_FILE_NAME } from './common/constants';
import loadJsonFile from './common/utils/loadJsonFile';
import type {
  LangConfig,
  Options,
  PrintFn,
  RawConfigFile,
  RawLanguageEntry,
  ResolvedOptions,
  SepsConfig,
  SharedSettings,
} from './common/types';

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
  Extensions(lang: string) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" needs an Extensions array`;
  },
  CommentPair(lang: string) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" needs a Comment pair, e.g. ["# ", ""]`;
  },
  CharacterLimit(lang: string) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" CharacterLimit must be a positive integer, e.g. 79`;
  },
  FillerCharacter(lang: string) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" FillerCharacter must be a single character, e.g. "="`;
  },
  DisableCapitalization(lang: string) {
    return `invalid ${CONFIG_FILE_NAME}: "${lang}" DisableCapitalization must be true or false`;
  },
};

const DefaultOptions: ResolvedOptions = {
  dryRun: false,
  printLog: value => console.log(value),
  printWarn: value => console.warn(value),
};

// pick up here, add bash scripts to "commit" and "commit + squash"
// double check things in the playground still work

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 */
function insertSeparators(targetPath: string, options: Options = {}): string[] {
  const opts: ResolvedOptions = { ...DefaultOptions, ...options };
  const dirPath = configDirFor(targetPath);
  const { All, ...languages } = loadConfig(dirPath, opts.printLog);
  const languagesEntries = Object.entries(languages);
  const configuredLanguagesArr = languagesEntries.map(([langKey, entry]) =>
    configureLangEntry(langKey, entry, All),
  );
  return walk(targetPath, configuredLanguagesArr, opts);
}

// =========================== Private Helpers ============================= //

/**
 * @private
 * Resolve the effective config: DefaultConfig, overridden per-language by any
 * seps-config.json found in the config directory. Unknown language keys in the
 * JSON define new languages.
 */
function loadConfig(cwd: string, printLog: PrintFn): SepsConfig {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  if (!fs.existsSync(configPath)) {
    return DefaultConfig;
  }
  // Load overrides from config file
  let overrides: RawConfigFile;
  try {
    overrides = loadJsonFile<RawConfigFile>(configPath);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const message = `invalid ${CONFIG_FILE_NAME}: ${reason}`;
    throw new Error(message, { cause: err });
  }
  // "All" holds settings shared by every language (CharacterLimit,
  // FillerCharacter); per-language values still win over them. Every other
  // key is a language.
  const { All: allOverrides, ...langOverrides } = overrides;
  const config: SepsConfig = { All: { ...DefaultConfig.All, ...allOverrides } };
  const defaultLangs = Object.keys(DefaultConfig).filter(key => key !== 'All');
  const set = new Set([...defaultLangs, ...Object.keys(langOverrides)]);
  for (const lang of set) {
    const defaults = (DefaultConfig as SepsConfig)[lang] as object | undefined;
    const override = langOverrides[lang] as object | undefined;
    config[lang] = { ...defaults, ...override } as SepsConfig[string];
  }
  printLog(`Using config overrides from: ${configPath}`);
  // Return
  return config;
}

/**
 * @private
 * Directory whose seps-config.json applies to a target path: the target's own
 * directory if it has one, otherwise the directory seps is being run from.
 */
function configDirFor(targetPath: string): string {
  const isTargetDir = fs.statSync(targetPath).isDirectory();
  const targetPathFull = isTargetDir ? targetPath : path.dirname(targetPath);
  const configFilePath = path.join(targetPathFull, CONFIG_FILE_NAME);
  return fs.existsSync(configFilePath) ? targetPathFull : process.cwd();
}

/**
 * @private
 * Compile a declarative language entry into the matchers used while walking:
 * a FILE_EXT regex and REGION/SECTION marker regexes built from the comment
 * syntax around the fixed marker tokens. CharacterLimit/FillerCharacter fall
 * back to the shared "All" settings.
 */
function configureLangEntry(
  lang: string,
  entry: unknown,
  all: SharedSettings,
): LangConfig {
  const {
    Extensions,
    Comment,
    CharacterLimit,
    FillerCharacter,
    DisableCapitalization,
    Bookends,
  } = (entry ?? {}) as RawLanguageEntry;
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
  if (!isPositiveInt(charLimit)) {
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

  // pick up here, marker needs to be a standalone function: getMarkerRegex

  // Capture the label if present. A bare marker ("// @reg" with no label) still
  // matches, but is warned about and skipped rather than formatted.
  const marker = (token: string) =>
    new RegExp(
      `^\\s*${escapeRegex(open)}${escapeRegex(token)}(?: (.+?))?${escapeRegex(close)}\\s*$`,
    );
  const exts = Extensions.map((ext: string) =>
    escapeRegex(ext.replace(/^\./, '')),
  );
  // Bookends default to the comment syntax when the language doesn't set them.
  const bookends = (Bookends ??
    (close ? [open, close] : [open, ` ${open.trim()}`])) as [string, string];
  // Return
  return {
    FILE_EXT: new RegExp(`\\.(${exts.join('|')})$`),
    REGION_MARKER: marker(Markers.REGION),
    SECTION_MARKER: marker(Markers.SECTION),
    BOOKENDS: bookends,
    CHAR_LIMIT: charLimit,
    FILLER: fillerChar,
    DISABLE_CAP: disableCap,
  };
}

/**
 * @private
 * Check a value is an integer of at least 1.
 */
function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1;
}

/**
 * @private
 * Escape regex special characters in a literal string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @private
 * Recursively walk a path, rewriting markers in every supported file.
 */
function walk(
  targetPath: string,
  langConfigArr: LangConfig[],
  options: ResolvedOptions,
): string[] {
  const updated: string[] = [];
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
  const langConfig =
    langConfigArr.find(type => type.FILE_EXT.test(targetPath)) ?? null;
  if (!langConfig) return updated;
  // Write the separator comment
  const content = fs.readFileSync(targetPath, 'utf8');
  const next = formatSeparators(
    content,
    langConfig,
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
 * // pick up here, refactor so that this function is just for the .map part
 *
 * @private
 * Determine whether to format a "section" or a "region".
 */
function formatSeparators(
  text: string,
  langConfig: LangConfig,
  filePath: string,
  printWarn: PrintFn,
): string {
  return text
    .split('\n')
    .map((line, index) => {
      const indent = line.match(/^(\s*)/)?.[1] ?? '';
      const sectionMatch = line.match(langConfig.SECTION_MARKER);
      // Insert "section" separator
      if (sectionMatch) {
        const label = sectionMatch[1]?.trim() ?? '';
        if (!label)
          return printNoLabelWarning(filePath, index, printWarn, line);
        return formatSection(
          capitalizeLabel(label, langConfig),
          langConfig,
          indent,
        );
      }
      // Insert "region" separator
      const regionMatch = line.match(langConfig.REGION_MARKER);
      if (regionMatch) {
        const label = regionMatch[1]?.trim() ?? '';
        if (!label)
          return printNoLabelWarning(filePath, index, printWarn, line);
        return formatRegion(
          capitalizeLabel(label, langConfig),
          langConfig,
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
 */
function printNoLabelWarning(
  filePath: string,
  index: number,
  printWarn: PrintFn,
  line: string,
): string {
  const message =
    `Warning: ${filePath}:${index + 1}: separator marker has no label, ` +
    'skipping';
  printWarn(message);
  return line;
}

/**
 * @private
 * Capitalize each word in a label (first letter upper, rest lower), unless the
 * language has DisableCapitalization set. Words that start or end with a
 * non-alphanumeric character are left untouched (e.g. "@decorator", "foo()").
 */
function capitalizeLabel(label: string, langConfig: LangConfig): string {
  if (langConfig.DISABLE_CAP) return label;
  return label
    .split(/\s+/)
    .map(word => {
      const getIsAlphaNum = (ch: string) => /[a-z0-9]/i.test(ch);
      if (!getIsAlphaNum(word[0]) || !getIsAlphaNum(word[word.length - 1])) {
        return word;
      }
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * @private
 * Build a single-line section header centered within `[open] = label = [close]`.
 * Filler fills up to the character limit and stops; a label too long to fit
 * simply gets no filler rather than pushing the line past the limit.
 */
function formatSection(
  label: string,
  langConfig: LangConfig,
  indent: string,
): string {
  const [open, close] = langConfig.BOOKENDS;
  const filler = langConfig.FILLER;
  const lineLen = langConfig.CHAR_LIMIT - indent.length;
  const available = lineLen - open.length - close.length - label.length - 2;
  const left = Math.max(Math.ceil(available / 2), 0);
  const right = Math.max(Math.floor(available / 2), 0);
  return `${indent}${open}${filler.repeat(left)} ${label} ${filler.repeat(right)}${close}`;
}

/**
 * @private
 * Build a 3-line region header block with the label centered on the middle line.
 * Rule lines stop at the character limit: "// " + filler + " //".
 */
function formatRegion(
  label: string,
  paddingType: LangConfig,
  indent: string,
): string {
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
