import fs from 'fs';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Read a JSON file and return it as an object. Throws if the file is not valid
 * JSON, or if it parses to something other than a plain object (an array,
 * number, string, boolean, or null).
 *
 * @param {string} filePath
 * @returns {object}
 */
function loadJsonFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  // Parse it
  let parsed;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    throw new Error(`invalid JSON in "${filePath}": ${err.message}`, {
      cause: err,
    });
  }
  // Make sure it's an object (not an array, null, or a bare primitive)
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`expected "${filePath}" to contain a JSON object or array`);
  }
  // Return
  return parsed;
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default loadJsonFile;
