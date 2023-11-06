var crypto = require('crypto');
var config = require('config');
var bcrypt = require('bcryptjs');
var base64url = require('base64url');

/**
 * Encrypts the given string
 * @param {String} string - The string to encrypt
 * @return {String} - The encrypted string
 */
function encrypt(string) {
  var cipher = crypto.createCipher(config.cryptography.algorithm, config.cryptography.salt);
  var encrypted = cipher.update(string, 'utf8', 'hex') + cipher.final('hex');

  return encrypted;
}

/**
 * Decrypts the given string (assuming it is encrypted using the above function)
 * @param {String} string - The encrypted string to decrypt
 * @return {String} - The decrypted string
 */
function decrypt(string) {
  var decipher = crypto.createDecipher(config.cryptography.algorithm, config.cryptography.salt);
  var decrypted = decipher.update(string, 'hex', 'utf8') + decipher.final('utf8');

  return decrypted;
}

/**
 * Encrypts the given string
 * @param {String} string - The string to encrypt
 * @return {String} - The encrypted string
 */
function encryptString(string) {
  var salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(string, salt, null);
}

/**
 * Compares string using bycrypt algorithm
 * @param {String} string - The encrypted string to compare
 * @param {String} hash - The hash to compare with the string
 * @return {Boolean} - True when the hash matches the given string
 */
function encryptedStringMatches(string, hash) { return bcrypt.compareSync(string, hash); }

/**
 * Generates a random password
 * @returns {String} A randomly generated password
 */
function generateRandomPassword() {
  return base64url(crypto.randomBytes(20)).replace(/[\W_]+/g, '');
}

module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;
module.exports.encryptString = encryptString;
module.exports.encryptedStringMatches = encryptedStringMatches;
module.exports.generateRandomPassword = generateRandomPassword;
