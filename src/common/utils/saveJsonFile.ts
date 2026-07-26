import fs from 'fs';

// ========================================================================= //
//                                    Types                                  //
// ========================================================================= //

type Stringify = (value: unknown) => string;

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //
// Taken from: https://github.com/seanpmaxwell/js-dumping-ground/blob/main/files/saveJsonFile.ts

/**
 * Save an object (or array) to a JSON file. Appends ".json" to the path unless
 * it already ends with it. Pass `stringify` to control serialization (defaults
 * to JSON.stringify with 2-space indentation). Returns the path written to.
 */
function saveJsonFile(
  filePath: string,
  value: unknown,
  stringify: Stringify = defaultStringify,
): string {
  const doesEndWithJson = filePath.toLowerCase().endsWith('.json');
  const fullPath = doesEndWithJson ? filePath : `${filePath}.json`;
  const fileContent = stringify(value);
  fs.writeFileSync(fullPath, `${fileContent}\n`, 'utf8');
  return fullPath;
}

/**
 * @private
 *
 * Default serializer: pretty JSON with 2-space indentation.
 */
function defaultStringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default saveJsonFile;
