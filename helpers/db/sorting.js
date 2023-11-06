const _ = require('lodash');
/**
 * Takes an array of sorting options and converts them into sorting options for
 *  Mongo
 * @param {Array} sortArray - Array of field and direction values to convert to a
 *  string that Mongo can use for sorting
 * @param {String} - Sorting string we can use for Mongo
 */
function convertOrderByToMongo(orderArray) {
  const sortArray = {};
  Object.keys(orderArray).forEach((columnName) => {
    sortArray[columnName] = orderArray[columnName] === 'desc' ? -1 : 1;
  });
  return sortArray;
}

/**
 * Sort an array of elements, ascending or descending order by using lodash _sortBy function
 * @param {Array} collection - The collection to iterate over
 * @param {String} - Sorting string to sort array elements, if - (minues) then descending
 * @return {Array} Sorted Array
 */
function sortArrayElements(collection, sortByField) {
  let sortBy = sortByField;
  if (sortByField.substring(0, 1) === '-') {
    sortBy = sortByField.substr(1, sortByField.length);
    return _.sortBy(collection, sortBy).reverse();
  }
  return _.sortBy(collection, sortBy);
}


const sorting = {
  convertOrderByToMongo,
  sortArrayElements,
};

module.exports = sorting;
