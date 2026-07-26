import fs from 'fs';

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //
// Taken from: [https://github.com/seanpmaxwell/dev-dumping-ground/blob/main/files/loadJsonFile.ts]

/**
 * Read a JSON file and return it as an object. Throws if the file is not valid
 * JSON, or if it parses to something other than a plain object (an array,
 * number, string, boolean, or null).
 *
 * The caller declares the shape it expects via `T`; the contents of a JSON
 * file cannot be verified at compile time.
 */
function loadJsonFile<T = Record<string, unknown>>(filePath: string): T {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  // Parse it
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`invalid JSON in "${filePath}": ${reason}`, { cause: err });
  }
  // Make sure it's an object
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error(`expected "${filePath}" to contain a JSON object or array`);
  }
  // Return
  return parsed as T;
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default loadJsonFile;
