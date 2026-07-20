/* eslint-disable no-undef */

import fs from 'fs';
import path from 'path';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const TOTAL_LEN = 119;

export const PaddingParams = {
  Js: {
    FILE_EXT: /\.(ts|tsx|js|jsx|mjs)$/,
    REGION_MARKER: /^\s*\/\/ r~~ (.+)/,
    SECTION_MARKER: /^\s*\/\/ s~~ (.+)/,
    BOOKENDS: ['// ', ' //'],
  },
  Java: {
    FILE_EXT: /\.(java)$/,
    REGION_MARKER: /^\s*\/\* r~~ (.+?) \*\/\s*$/,
    SECTION_MARKER: /^\s*\/\* s~~ (.+?) \*\/\s*$/,
    BOOKENDS: ['// ', ' //'],
  },
  Java: {
    FILE_EXT: /\.(java)$/,
    REGION_MARKER: /^\s*\/\* r~~ (.+?) \*\/\s*$/,
    SECTION_MARKER: /^\s*\/\* s~~ (.+?) \*\/\s*$/,
    BOOKENDS: ['// ', ' //'],
  },
};

const PADDING_TYPES = Object.values(PaddingParams);

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Process a path (file or directory). Directories are walked recursively.
 * Returns the list of file paths that were updated.
 */
function insertSeparators(targetPath, { dryRun = false, log = console.log } = {}) {
  const updated = [];
  const stat = fs.statSync(targetPath);
  // 
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      updated.push(...insertSeparators(path.join(targetPath, entry.name), { dryRun, log }));
    }
    return updated;
  }
  // 
  const paddingType = paddingTypeForFile(targetPath);
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
 * Return the padding params whose FILE_EXT matches the given filename, or null
 * if the file type is not supported.
 */
function paddingTypeForFile(fileName) {
  return PADDING_TYPES.find(type => type.FILE_EXT.test(fileName)) ?? null;
}

/**
 * Format header markers so the label is centered and the result is exactly
 * {TOTAL_LEN} characters wide. Two kinds are supported:
 *
 * Region ("// r~~ someText") -> a 3-line block:
 *
 * // ====================================================================== //
 * //                                  someText                              //
 * // ====================================================================== //
 *
 * Section ("// s~~ someText") -> a single line:
 *
 * // ==================== someText ===================== //
 */
function formatHeaders(text, paddingType) {
  return text.split('\n').map(line => {
    const indent = line.match(/^(\s*)/)[1];
    const sectionMatch = line.match(paddingType.SECTION_MARKER);
    if (sectionMatch) {
      return formatSection(sectionMatch[1]?.trim() ?? '', paddingType, indent);
    }
    const regionMatch = line.match(paddingType.REGION_MARKER);
    if (regionMatch) {
      return formatRegion(regionMatch[1]?.trim() ?? '', indent);
    }
    return line;
  }).join('\n');
}

/**
 * Build a single-line section header centered within `[open] = label = [close]`.
 */
function formatSection(label, paddingType, indent) {
  const [open, close] = paddingType.BOOKENDS;
  const lineLen = TOTAL_LEN - indent.length;
  const available = lineLen - open.length - close.length - label.length - 2;
  const left = Math.max(Math.ceil(available / 2), 0);
  const right = Math.max(Math.floor(available / 2), 0);
  return `${indent}${open}${'='.repeat(left)} ${label} ${'='.repeat(right)}${close}`;
}

/**
 * Build a 3-line region header block with the label centered on the middle line.
 * Each line is exactly {TOTAL_LEN} characters: "// " + content + " //"
 */
function formatRegion(label, indent) {
  const [open, close] = ['// ', ' //'];
  const lineLen = TOTAL_LEN - indent.length;
  const inner = lineLen - open.length - close.length;
  const rule = indent + open + '='.repeat(inner) + close;
  const leftPad = Math.max(Math.floor((inner - label.length) / 2), 0);
  const rightPad = Math.max(inner - label.length - leftPad, 0);
  const middle = indent + open + ' '.repeat(leftPad) + label + ' '.repeat(rightPad) + close;
  return [rule, middle, rule].join('\n');
}

// ================================================================================================================= //
//                                                      Export                                                       //
// ================================================================================================================= //

export default insertSeparators;
