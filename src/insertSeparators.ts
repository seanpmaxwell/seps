import path from 'path';
import DefaultConfig from './common/constants/DefaultConfig';
import { CONFIG_FILE_NAME } from './common/constants/misc';
import loadJsonFile from './common/utils/loadJsonFile';
import type {
  LangConfig,
  RawConfigFile,
  RawLanguageEntry,
  SepsConfig,
  SharedSettings,
} from './common/types';
import logger from './common/utils/logger';
import fileUtils from './common/utils/fileUtils';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

// Marker tokens written in source files: "// @reg Label", "/* @sec Label */".
// These are fixed and not configurable.
const Markers = {
  REGION: '@reg',
  SECTION: '@sec',
};

const ErrorMessages = {
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
  MissingLabel(filePath: string, line: number) {
    return (
      `Warning: ${filePath}:${line}: separator marker has no ` +
      'label, skipping'
    );
  },
};

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 */
function insertSeparators(targetPath: string): string[] {
  const dirPath = configDirFor(targetPath);
  const { All, ...languages } = loadConfig(dirPath);
  const languagesEntries = Object.entries(languages);
  const configuredLanguagesArr = languagesEntries.map(([langKey, entry]) =>
    configureLangEntry(langKey, entry, All),
  );
  return walkDirectoryRecursively(targetPath, configuredLanguagesArr);
}

// =========================== Private Helpers ============================= //

/**
 * @private
 *
 * Resolve the effective config: DefaultConfig, overridden per-language by any
 * seps-config.json found in the config directory. Unknown language keys in the
 * JSON define new languages.
 */
function loadConfig(cwd: string): SepsConfig {
  const configPath = path.join(cwd, CONFIG_FILE_NAME);
  if (!fileUtils.exists(configPath)) {
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
  logger.info(`Using config overrides from: ${configPath}`);
  // Return
  return config;
}

/**
 * @private
 *
 * Directory whose seps-config.json applies to a target path: the target's own
 * directory if it has one, otherwise the directory seps is being run from.
 */
function configDirFor(targetPath: string): string {
  const isTargetDir = fileUtils.isDir(targetPath);
  const targetPathFull = isTargetDir ? targetPath : path.dirname(targetPath);
  const configFilePath = path.join(targetPathFull, CONFIG_FILE_NAME);
  return fileUtils.exists(configFilePath) ? targetPathFull : process.cwd();
}

/**
 * @private
 *
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
    const message = ErrorMessages.Extensions(lang);
    throw new Error(message);
  }
  const [open, close] = Array.isArray(Comment) ? Comment : [];
  if (typeof open !== 'string' || typeof close !== 'string') {
    const message = ErrorMessages.CommentPair(lang);
    throw new Error(message);
  }
  const charLimit = CharacterLimit ?? all.CharacterLimit;
  if (!isPositiveInt(charLimit)) {
    const message = ErrorMessages.CharacterLimit(lang);
    throw new Error(message);
  }
  const fillerChar = FillerCharacter ?? all.FillerCharacter;
  if (typeof fillerChar !== 'string' || fillerChar.length !== 1) {
    const message = ErrorMessages.FillerCharacter(lang);
    throw new Error(message);
  }
  const disableCap =
    DisableCapitalization ?? all.DisableCapitalization ?? false;
  if (typeof disableCap !== 'boolean') {
    const message = ErrorMessages.DisableCapitalization(lang);
    throw new Error(message);
  }
  // Bookends default to the comment syntax when the language doesn't set them.
  let bookends: [string, string];
  if (!Bookends) {
    const closeFinal = close ?? ` ${open.trim()}`;
    bookends = [open, closeFinal];
  } else {
    bookends = Bookends as [string, string];
  }
  // Capture the label if present. A bare marker ("// @reg" with no label) still
  // matches, but is warned about and skipped rather than formatted.
  const marker = (token: string) =>
    new RegExp(
      `^\\s*${escapeRegex(open)}${escapeRegex(token)}(?: (.+?))?${escapeRegex(close)}\\s*$`,
    );
  // Return
  return {
    FILE_EXT: getExtensionRegex(Extensions),
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
 *
 */
function getExtensionRegex(extensions: string[]): RegExp {
  const cleanExtensions = extensions.map((ext: string) => {
    const extFinal = ext.replace(/^\./, '');
    return escapeRegex(extFinal);
  });
  return new RegExp(`\\.(${cleanExtensions.join('|')})$`);
}

/**
 * @private
 *
 * Escape regex special characters in a literal string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @private
 *
 * Recursively walk a path, rewriting markers in every supported file.
 */
function walkDirectoryRecursively(
  targetPath: string,
  langConfigArr: LangConfig[],
): string[] {
  const updated: string[] = [];
  const isDirectory = fileUtils.isDir(targetPath);
  // Go recursive if directory
  if (isDirectory) {
    const entries = fileUtils.fetchDirFiles(targetPath);
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      const fileFullPath = path.join(targetPath, entry.name);
      const result = walkDirectoryRecursively(fileFullPath, langConfigArr);
      updated.push(...result);
    }
    return updated;
  }
  // Check the patting type
  const langConfig =
    langConfigArr.find(type => type.FILE_EXT.test(targetPath)) ?? null;
  if (!langConfig) return updated;
  // Write the separator comment (unless doing a dryRun)
  const content = fileUtils.read(targetPath);
  const next = content
    .split('\n')
    .map((line, i) =>
      checkForMarkerAndAddSeparator(line, i, langConfig, targetPath),
    )
    .join('\n');
  if (next !== content) {
    fileUtils.write(targetPath, next);
    const logMsgStart = fileUtils.getIsDryRun() ? 'Would update' : 'Updated';
    logger.info(logMsgStart + ': ' + targetPath);
    updated.push(targetPath);
  }
  // Return
  return updated;
}

/**
 * @private
 *
 * Determine whether to format a "section" or a "region".
 */
function checkForMarkerAndAddSeparator(
  line: string,
  index: number,
  langConfig: LangConfig,
  filePath: string,
): string {
  const indent = line.match(/^(\s*)/)?.[1] ?? '';
  const sectionMatch = line.match(langConfig.SECTION_MARKER);
  // Insert "section" separator
  if (sectionMatch) {
    const label = sectionMatch[1]?.trim() ?? '';
    if (!label) return printMissingLabelWarning(filePath, index, line);
    const labelFinal = capitalizeLabel(label, langConfig);
    return formatSection(labelFinal, langConfig, indent);
  }
  // Insert "region" separator
  const regionMatch = line.match(langConfig.REGION_MARKER);
  if (regionMatch) {
    const label = regionMatch[1]?.trim() ?? '';
    if (!label) return printMissingLabelWarning(filePath, index, line);
    const labelFinal = capitalizeLabel(label, langConfig);
    return formatRegion(labelFinal, langConfig, indent);
  }
  // Return unedited line if no marker found
  return line;
}

/**
 * @private
 *
 * Warn that a marker on the given (0-based) line has no label, and return the
 * line unchanged so nothing is inserted.
 */
function printMissingLabelWarning(
  filePath: string,
  index: number,
  line: string,
): string {
  const message = ErrorMessages.MissingLabel(filePath, index + 1);
  logger.warn(message);
  return line;
}

/**
 * @private
 *
 * Capitalize each word in a label (first letter upper, rest lower), unless the
 * language has DisableCapitalization set. Words that start or end with a
 * non-alphanumeric character are left untouched (e.g. "@decorator", "foo()").
 */
function capitalizeLabel(label: string, langConfig: LangConfig): string {
  if (langConfig.DISABLE_CAP) return label;
  return label
    .split(/\s+/)
    .map(word => {
      if (!getIsAlphaNum(word[0]) || !getIsAlphaNum(word[word.length - 1])) {
        return word;
      }
      return word[0].toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * @private
 *
 * Check if a string is an alphanumeric string.
 */
function getIsAlphaNum(value: string): boolean {
  return /[a-z0-9]/i.test(value);
}

/**
 * @private
 *
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
 *
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
