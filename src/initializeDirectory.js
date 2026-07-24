import fs from 'fs';
import path from 'path';
import DefaultConfig from './common/DefaultConfig';
import { CONFIG_FILE_NAME } from './common/constants';
import customStringifyObject from './common/utils/customStringifyObject';

// ========================================================================= //
//                                  Constants                                //
// ========================================================================= //

const CONFIG_FILE_ALREADY_EXISTS_ERROR = `${CONFIG_FILE_NAME} already exists here, not overwriting`;

// ========================================================================= //
//                                  Functions                                //
// ========================================================================= //

/**
 * Generate a seps-config.json in the given directory (default: the directory
 * seps is being run from) containing all the default settings. Refuses to
 * overwrite an existing config. Returns the path of the written file.
 *
 * @param {string} dir
 * @returns {string}
 */
function initializeDirectory(dir = process.cwd()) {
  // Setup file path
  const configPath = path.join(dir, CONFIG_FILE_NAME);
  if (fs.existsSync(configPath)) {
    throw new Error(CONFIG_FILE_ALREADY_EXISTS_ERROR);
  }
  // Setup file content
  const configFileContent = customStringifyObject(DefaultConfig);
  fs.writeFileSync(configPath, `${configFileContent}\n`, 'utf8');
  // Return filepath
  return configPath;
}

// ========================================================================= //
//                                     Export                                //
// ========================================================================= //

export default initializeDirectory;
