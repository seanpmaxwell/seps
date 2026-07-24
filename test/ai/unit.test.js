import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { insertSeparators, initializeDirectory, loadJsonFile } from '../../src';

// ========================================================================= //
//                                      Run                                  //
// ========================================================================= //

// A fresh temp directory per test keeps each case isolated. seps falls back to
// process.cwd() for config, and the project root has no seps-config.json, so a
// temp dir without one exercises the built-in defaults.
let dir;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seps-test-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

// ========================================================================= //
//                                  Helpers                                  //
// ========================================================================= //

function write(rel, content) {
  const p = path.join(dir, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

function writeConfig(obj) {
  fs.writeFileSync(
    path.join(dir, 'seps-config.json'),
    typeof obj === 'string' ? obj : JSON.stringify(obj),
    'utf8',
  );
}

function read(rel) {
  return fs.readFileSync(path.join(dir, rel), 'utf8');
}

function run(target = dir, opts = {}) {
  const printLog = vi.fn();
  const printWarn = vi.fn();
  const updated = insertSeparators(target, { printLog, printWarn, ...opts });
  return { updated, printLog, printWarn };
}

// Assert a generated separator line is well-formed.
function expectLine(line, over = {}) {
  const { len = 79, open = '// ', close = ' //' } = over;
  expect(line.length).toBe(len);
  expect(line.startsWith(open)).toBe(true);
  expect(line.endsWith(close)).toBe(true);
}

// ========================================================================= //
//                             Section formatting                            //
// ========================================================================= //

describe('section formatting (// @sec)', () => {
  it('produces a single centered line at the character limit', () => {
    write('a.js', '// @sec hello\n');
    run();
    const [line] = read('a.js').split('\n');
    expectLine(line);
    expect(line).toContain(' Hello ');
  });

  it('surrounds the label with the filler character', () => {
    write('a.js', '// @sec hi\n');
    run();
    const line = read('a.js').split('\n')[0];
    expect(line).toMatch(/^\/\/ =+ Hi =+ \/\/$/);
  });

  it('leaves non-marker lines untouched', () => {
    write('a.js', 'const x = 1;\n// not a marker\n');
    run();
    expect(read('a.js')).toBe('const x = 1;\n// not a marker\n');
  });

  it('respects indentation and still ends at the limit', () => {
    write('a.js', '    // @sec nested\n');
    run();
    const line = read('a.js').split('\n')[0];
    expect(line.length).toBe(79);
    expect(line.startsWith('    // ')).toBe(true);
  });
});

// ========================================================================= //
//                             Region formatting                             //
// ========================================================================= //

describe('region formatting (// @reg)', () => {
  it('produces a 3-line block with matching rule lines', () => {
    write('a.js', '// @reg hello\n');
    run();
    const lines = read('a.js').split('\n');
    expect(lines[0]).toBe(lines[2]);
    expectLine(lines[0]);
    expectLine(lines[1]);
    expect(lines[1]).toContain('Hello');
  });

  it('rule lines are entirely filler between the bookends', () => {
    write('a.js', '// @reg x\n');
    run();
    const rule = read('a.js').split('\n')[0];
    expect(rule).toMatch(/^\/\/ =+ \/\/$/);
  });

  it('keeps rule lines at the limit even when the label overflows', () => {
    write('a.js', `// @reg ${'x'.repeat(200)}\n`);
    run();
    const lines = read('a.js').split('\n');
    expect(lines[0].length).toBe(79);
    expect(lines[2].length).toBe(79);
    expect(lines[1].length).toBeGreaterThan(79); // not forced to the limit
  });
});

// ========================================================================= //
//                              Capitalization                               //
// ========================================================================= //

describe('label capitalization', () => {
  const label = src => {
    write('a.js', `// @sec ${src}\n`);
    run();
    return read('a.js')
      .split('\n')[0]
      .match(/=+ (.+?) =+/)[1];
  };

  it('title-cases lowercase words', () => {
    expect(label('hello world')).toBe('Hello World');
  });

  it('lowercases the tail of all-caps words', () => {
    expect(label('HELLO WORLD')).toBe('Hello World');
  });

  it('capitalizes a word with an internal dot', () => {
    expect(label('data.json handler')).toBe('Data.json Handler');
  });

  it('leaves words starting with a non-alphanumeric untouched', () => {
    expect(label('@decorator stays')).toBe('@decorator Stays');
  });

  it('leaves words ending with a non-alphanumeric untouched', () => {
    expect(label('call foo()')).toBe('Call foo()');
  });

  it('collapses runs of whitespace between words', () => {
    expect(label('a    b')).toBe('A B');
  });

  it('can be disabled globally via DisableCapitalization', () => {
    writeConfig({ All: { DisableCapitalization: true } });
    write('a.js', '// @sec keep AS is\n');
    run();
    expect(read('a.js').split('\n')[0]).toContain(' keep AS is ');
  });

  it('can be disabled per language', () => {
    writeConfig({ JavaScript: { DisableCapitalization: true } });
    write('a.js', '// @sec leave ME\n');
    run();
    expect(read('a.js').split('\n')[0]).toContain(' leave ME ');
  });
});

// ========================================================================= //
//                            Label-less markers                             //
// ========================================================================= //

describe('markers with no label', () => {
  it('leaves a bare marker untouched and warns with file and line', () => {
    const p = write('a.js', 'x\n// @reg\ny\n');
    const { updated, printWarn } = run();
    expect(read('a.js')).toBe('x\n// @reg\ny\n');
    expect(updated).toHaveLength(0);
    expect(printWarn).toHaveBeenCalledWith(
      `Warning: ${p}:2: separator marker has no label, skipping`,
    );
  });

  it('treats a marker with only trailing spaces as label-less', () => {
    write('a.js', '// @sec   \n');
    const { printWarn } = run();
    expect(printWarn).toHaveBeenCalledTimes(1);
  });

  it('still formats other markers in the same file', () => {
    write('a.js', '// @reg\n// @reg Real\n');
    const { updated, printWarn } = run();
    const lines = read('a.js').split('\n');
    expect(lines[0]).toBe('// @reg');
    expectLine(lines[1]);
    expect(updated).toHaveLength(1);
    expect(printWarn).toHaveBeenCalledTimes(1);
  });
});

// ========================================================================= //
//                            Config: overrides                              //
// ========================================================================= //

describe('configuration overrides', () => {
  it('uses built-in defaults when no config file exists', () => {
    write('a.js', '// @sec x\n');
    run();
    expect(read('a.js').split('\n')[0].length).toBe(79);
  });

  it('honors a CharacterLimit override in All', () => {
    writeConfig({ All: { CharacterLimit: 40 } });
    write('a.js', '// @sec x\n');
    run();
    expect(read('a.js').split('\n')[0].length).toBe(40);
  });

  it('honors a FillerCharacter override in All', () => {
    writeConfig({ All: { FillerCharacter: '-' } });
    write('a.js', '// @sec x\n');
    run();
    expect(read('a.js').split('\n')[0]).toMatch(/^\/\/ -+ X -+ \/\/$/);
  });

  it('lets a per-language value win over All', () => {
    writeConfig({
      All: { CharacterLimit: 40 },
      JavaScript: { CharacterLimit: 60 },
    });
    write('a.js', '// @sec x\n');
    run();
    expect(read('a.js').split('\n')[0].length).toBe(60);
  });

  it('honors a Bookends override', () => {
    writeConfig({ JavaScript: { Bookends: ['/* ', ' */'] } });
    write('a.js', '// @sec x\n');
    run();
    const line = read('a.js').split('\n')[0];
    expect(line.startsWith('/* ')).toBe(true);
    expect(line.endsWith(' */')).toBe(true);
  });

  it('defines a new language from an unknown top-level key', () => {
    writeConfig({ Python: { Extensions: ['py'], Comment: ['# ', ''] } });
    write('a.py', '# @sec hello\n');
    run();
    const line = read('a.py').split('\n')[0];
    expect(line.startsWith('# ')).toBe(true);
    expect(line).toContain(' Hello ');
  });

  it('reads config from the target directory before the cwd', () => {
    writeConfig({ All: { CharacterLimit: 30 } });
    const file = write('a.js', '// @sec x\n');
    run(file); // single-file target -> config resolved from its directory
    expect(read('a.js').split('\n')[0].length).toBe(30);
  });
});

// ========================================================================= //
//                          Config: validation                              //
// ========================================================================= //

describe('configuration validation', () => {
  const expectThrows = re => {
    write('a.js', '// @sec x\n');
    expect(() =>
      insertSeparators(dir, { printLog: vi.fn(), printWarn: vi.fn() }),
    ).toThrow(re);
  };

  it('rejects malformed JSON', () => {
    writeConfig('{ not valid json');
    expectThrows(/invalid seps-config\.json/);
  });

  it('rejects a language with no Extensions', () => {
    writeConfig({ Foo: { Comment: ['// ', ''] } });
    expectThrows(/needs an Extensions array/);
  });

  it('rejects an empty Extensions array', () => {
    writeConfig({ Foo: { Extensions: [], Comment: ['// ', ''] } });
    expectThrows(/needs an Extensions array/);
  });

  it('rejects a non-pair Comment', () => {
    writeConfig({ Foo: { Extensions: ['foo'], Comment: '//' } });
    expectThrows(/needs a Comment pair/);
  });

  it('rejects a zero CharacterLimit', () => {
    writeConfig({ All: { CharacterLimit: 0 } });
    expectThrows(/CharacterLimit must be a positive integer/);
  });

  it('rejects a negative CharacterLimit', () => {
    writeConfig({ All: { CharacterLimit: -5 } });
    expectThrows(/CharacterLimit must be a positive integer/);
  });

  it('rejects a non-integer CharacterLimit', () => {
    writeConfig({ All: { CharacterLimit: 1.5 } });
    expectThrows(/CharacterLimit must be a positive integer/);
  });

  it('rejects an empty FillerCharacter', () => {
    writeConfig({ All: { FillerCharacter: '' } });
    expectThrows(/FillerCharacter must be a single character/);
  });

  it('rejects a multi-character FillerCharacter', () => {
    writeConfig({ All: { FillerCharacter: '==' } });
    expectThrows(/FillerCharacter must be a single character/);
  });

  it('rejects a non-boolean DisableCapitalization', () => {
    writeConfig({ All: { DisableCapitalization: 'yes' } });
    expectThrows(/DisableCapitalization must be true or false/);
  });
});

// ========================================================================= //
//                            Directory walking                              //
// ========================================================================= //

describe('directory walking', () => {
  it('recurses into subdirectories', () => {
    write('nested/deep/a.js', '// @sec x\n');
    const { updated } = run();
    expect(updated).toHaveLength(1);
    expect(read('nested/deep/a.js').split('\n')[0].length).toBe(79);
  });

  it('skips node_modules', () => {
    write('node_modules/pkg/a.js', '// @sec x\n');
    write('b.js', '// @sec x\n');
    const { updated } = run();
    expect(updated).toHaveLength(1);
    expect(read('node_modules/pkg/a.js')).toBe('// @sec x\n');
  });

  it('skips dotfiles and dot-directories', () => {
    write('.hidden/a.js', '// @sec x\n');
    write('.config.js', '// @sec x\n');
    const { updated } = run();
    expect(updated).toHaveLength(0);
  });

  it('skips unsupported file extensions', () => {
    write('a.txt', '// @sec x\n');
    const { updated } = run();
    expect(updated).toHaveLength(0);
    expect(read('a.txt')).toBe('// @sec x\n');
  });

  it('returns the list of updated file paths', () => {
    const a = write('a.js', '// @sec x\n');
    const b = write('b.js', '// @sec y\n');
    const { updated } = run();
    expect(updated.sort()).toEqual([a, b].sort());
  });
});

// ========================================================================= //
//                                  dry run                                  //
// ========================================================================= //

describe('dry run', () => {
  it('does not write files but reports what would change', () => {
    write('a.js', '// @sec x\n');
    const { updated, printLog } = run(dir, { dryRun: true });
    expect(read('a.js')).toBe('// @sec x\n');
    expect(updated).toHaveLength(1);
    expect(printLog).toHaveBeenCalledWith(
      expect.stringMatching(/^Would update:/),
    );
  });
});

// ========================================================================= //
//                                idempotency                                //
// ========================================================================= //

describe('idempotency', () => {
  it('makes no changes on a second run', () => {
    write('a.js', '// @reg hello\n// @sec world\n');
    run();
    const first = read('a.js');
    const { updated } = run();
    expect(read('a.js')).toBe(first);
    expect(updated).toHaveLength(0);
  });
});

// ========================================================================= //
//                          Language comment syntax                          //
// ========================================================================= //

describe('language comment syntaxes', () => {
  it('formats Ruby with # comments', () => {
    write('a.rb', '# @sec hello\n');
    run();
    const line = read('a.rb').split('\n')[0];
    expect(line.startsWith('# ')).toBe(true);
    expect(line.endsWith(' #')).toBe(true);
    expect(line).toContain(' Hello ');
  });

  it('formats SQL with -- comments', () => {
    write('a.sql', '-- @sec hello\n');
    run();
    const line = read('a.sql').split('\n')[0];
    expect(line.startsWith('-- ')).toBe(true);
    expect(line.endsWith(' --')).toBe(true);
  });

  it('formats CSS with /* */ block comments', () => {
    write('a.css', '/* @sec hello */\n');
    run();
    const line = read('a.css').split('\n')[0];
    expect(line.startsWith('/* ')).toBe(true);
    expect(line.endsWith(' */')).toBe(true);
    expect(line.length).toBe(79);
  });
});

// ========================================================================= //
//                          initializeDirectory()                            //
// ========================================================================= //

describe('initializeDirectory', () => {
  it('writes a parseable config with defaults and returns its path', () => {
    const p = initializeDirectory(dir);
    expect(p).toBe(path.join(dir, 'seps-config.json'));
    const parsed = loadJsonFile(p);
    expect(parsed.All).toMatchObject({
      CharacterLimit: 79,
      FillerCharacter: '=',
    });
    expect(parsed.JavaScript.Extensions).toContain('js');
  });

  it('keeps arrays on a single line', () => {
    initializeDirectory(dir);
    const content = read('seps-config.json');
    expect(content).toContain('"Extensions": ["ts", "tsx"');
    expect(content).not.toMatch(/"ts",\n/);
  });

  it('ends with a trailing newline', () => {
    initializeDirectory(dir);
    expect(read('seps-config.json').endsWith('\n')).toBe(true);
  });

  it('refuses to overwrite an existing config', () => {
    initializeDirectory(dir);
    expect(() => initializeDirectory(dir)).toThrow(/already exists/);
  });

  it('produces a config that seps then accepts', () => {
    initializeDirectory(dir);
    write('a.js', '// @sec hello\n');
    run();
    expect(read('a.js').split('\n')[0].length).toBe(79);
  });
});
