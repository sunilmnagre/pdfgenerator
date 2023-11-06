var fs = require('fs');
/**
 * Helper function that wraps the longer object prototype `hasOwnProperty` function
 * @param {Object} object - The object to check the property within
 * @param {String} propertyToFind Name of the property to find within the given object
 * @return {Boolean} True if the object contains the property to find
 */
function hasProperty(object, propertyToFind) {
  return Object.prototype.hasOwnProperty.call(object, propertyToFind);
}

/**
 * Helper function that creates directory if it doesn't exists already
 * @param {Object} directory - directory to be created
 */
function createDirectoryIfNotExists(directory) {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory);
  }
}

/**
 * Function to create a physical file by converting base64 string
 * @param {Object} base64FileData - File data object
 * @param {String} filePath-  Filepath
 * @return {String} Filename if true else error
 */
const base64ToFile = async (base64FileData, filePath) => {
  const randomStr = Math.random().toString().substr(2, 20);
  const fileName = randomStr + base64FileData.fileName + "." + base64FileData.extension;
  const fileToWrite = `${filePath}/${fileName}`;
  const content = base64FileData.content.split(';base64,').pop();
  try {
    fs.writeFileSync(fileToWrite, content, { encoding: 'base64' });
    return fileName;
  } catch (error) {
    throw 'Error converting file';
  }
}

module.exports = {
  hasProperty,
  createDirectoryIfNotExists,
  base64ToFile
};
