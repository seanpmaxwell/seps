// Each language declares its file extensions, the comment syntax markers are
// written in (open/close, close empty for line comments), and the bookends
// used for the generated header lines (defaults to the comment syntax). The
// marker regexes are built from these — no regexes in config files.

export const CONFIG_FILE_NAME = 'seps-config.json';

const DefaultConfig = Object.freeze({
  All: {
    CharacterLimit: 79,
    DisableCapitalization: false,
    FillerCharacter: '=',
  },
  JavaScript: {
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
  C: {
    Extensions: ['c', 'h'],
    Comment: ['// ', ''],
    Bookends: ['// ', ' //'],
  },
  Cpp: {
    Extensions: ['cpp', 'cc', 'cxx', 'hpp', 'hh', 'hxx'],
    Comment: ['// ', ''],
    Bookends: ['// ', ' //'],
  },
  Go: {
    Extensions: ['go'],
    Comment: ['// ', ''],
    Bookends: ['// ', ' //'],
  },
  Rust: {
    Extensions: ['rs'],
    Comment: ['// ', ''],
    Bookends: ['// ', ' //'],
  },
  Php: {
    Extensions: ['php'],
    Comment: ['// ', ''],
    Bookends: ['// ', ' //'],
  },
  Ruby: {
    Extensions: ['rb'],
    Comment: ['# ', ''],
    Bookends: ['# ', ' #'],
  },
  Sql: {
    Extensions: ['sql'],
    Comment: ['-- ', ''],
    Bookends: ['-- ', ' --'],
  },
});

export default DefaultConfig;
