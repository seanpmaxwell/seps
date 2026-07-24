// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //
// Taken from: [https://github.com/seanpmaxwell/js-dumping-ground/blob/main/strings/customStringifyObject]

/**
 * Serialize a config object like JSON.stringify(value, null, 2), but keep
 * arrays whose elements are all primitives on a single line (e.g.
 * "Markers": ["@reg", "@sec"]). Arrays containing an object or nested array
 * are expanded one element per line, like objects.
 *
 * @param {object} value
 * @param {string} indent
 * @returns {string}
 */
function customStringifyObject(value, indent = '') {
  // Stringify the array
  if (Array.isArray(value)) {
    if (value.every(isPrimitive)) {
      const stringArr = value.map(item => JSON.stringify(item));
      return `[${stringArr.join(', ')}]`;
    }
    const inner = `${indent}  `;
    const items = value.map(item => {
      const nestedObjStr = customStringifyObject(item, inner);
      return `${inner}${nestedObjStr}`;
    });
    const arrStr = items.join(',\n');
    return `[\n${arrStr}\n${indent}]`;
  }
  // Stringify non-array object
  if (value && typeof value === 'object') {
    const inner = `${indent}  `;
    const entries = Object.entries(value);
    const stringifiedEntries = entries.map(([key, val]) => {
      const keyStr = JSON.stringify(key);
      const valueStr = customStringifyObject(val, inner);
      return `${inner}${keyStr}: ${valueStr}`;
    });
    const fullObjStr = stringifiedEntries.join(',\n');
    return `{\n${fullObjStr}\n${indent}}`;
  }
  // Return
  return JSON.stringify(value);
}

/**
 * @private
 *
 * Check if the value is not an object.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isPrimitive(value) {
  return value === null || typeof value !== 'object';
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default customStringifyObject;
