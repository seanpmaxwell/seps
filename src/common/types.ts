// ========================================================================= //
//                                    Types                                  //
// ========================================================================= //

/**
 * The shared "All" block plus one entry per language.
 */
export interface SepsConfig {
  All: SharedSettings;
  [language: string]: SharedSettings | LanguageEntry;
}

/**
 * Settings shared by every language, held under the "All" key. A language may
 * override any of these individually.
 */
export interface SharedSettings {
  CharacterLimit: number;
  DisableCapitalization: boolean;
  FillerCharacter: string;
}

/**
 * A single language entry: which files it matches, the comment syntax markers
 * are written in, and any overrides of the shared settings.
 */
export interface LanguageEntry {
  Extensions: string[];
  Comment: [string, string];
  Bookends?: [string, string];
  CharacterLimit?: number;
  FillerCharacter?: string;
  DisableCapitalization?: boolean;
}

/**
 * A config exactly as read from a seps-config.json file. Nothing is trusted
 * here: every language entry is validated by `configureLangEntry` before use.
 */
export interface RawConfigFile {
  All?: Partial<SharedSettings>;
  [language: string]: unknown;
}

/**
 * A language entry straight from a config file, before validation.
 */
export interface RawLanguageEntry {
  Extensions?: unknown;
  Comment?: unknown;
  Bookends?: unknown;
  CharacterLimit?: unknown;
  FillerCharacter?: unknown;
  DisableCapitalization?: unknown;
}

/**
 * A language entry compiled into the matchers and settings used while walking
 * files. This is the validated, ready-to-use form of a `LanguageEntry`.
 */
export interface LangConfig {
  FILE_EXT: RegExp;
  REGION_MARKER: RegExp;
  SECTION_MARKER: RegExp;
  BOOKENDS: [string, string];
  CHAR_LIMIT: number;
  FILLER: string;
  DISABLE_CAP: boolean;
}
