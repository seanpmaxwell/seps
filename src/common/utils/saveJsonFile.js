import fs from 'fs';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //
// Taken from: https://github.com/seanpmaxwell/js-dumping-ground/blob/main/files/saveJsonFile

/**
 * Save an object (or array) to a JSON file. Appends ".json" to the path unless
 * it already ends with it. Pass `stringify` to control serialization (defaults
 * to JSON.stringify with 2-space indentation). Returns the path written to.
 *
 * @param {string} filePath
 * @param {object | unknown[]} value
 * @param {(value: unknown) => string} [stringify]
 * @returns {string}
 */
function saveJsonFile(filePath, value, stringify = defaultStringify) {
  const doesEndWithJson = filePath.toLowerCase().endsWith('.json');
  const fullPath = doesEndWithJson ? filePath : `${filePath}.json`;
  const fileContent = stringify(value);
  fs.writeFileSync(fullPath, `${fileContent}\n`, 'utf8');
  return fullPath;
}

/**
 * @private
 * Default serializer: pretty JSON with 2-space indentation.
 *
 * @param {object} value
 * @returns {string}
 */
function defaultStringify(value) {
  return JSON.stringify(value, null, 2);
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default saveJsonFile;
