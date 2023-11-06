var config = require('config');

/**
* Takes the query array for MySQL and adds pagination options if they are required
* @param {Array} query - Array of query parameters to be passed to MySQL
* @param {Number} itemsPerPage - The number of items per page to show
* @param {Number} pageNumber - The page number to show
*/
function paginateMySql(query, itemsPerPage = config.pagination.itemsPerPage, pageNumber = 1) {
  query.limit = itemsPerPage;
  query.offset = (pageNumber - 1) * itemsPerPage;
}

/**
* Takes the cursor for Mongo and adds pagination options if they are required
* @param {Object} cursor - Mongo cursor to be modified
* @param {Number} itemsPerPage - The number of items per page to show
* @param {Number} pageNumber - The page number to show
*/
function paginateMongo(cursor, itemsPerPage = config.pagination.itemsPerPage, pageNumber = 1) {
  cursor.skip((pageNumber - 1) * itemsPerPage);
  cursor.limit(itemsPerPage);
  return cursor;
}

/**
* Takes the Array of items and adds pagination options if they are required
* @param {Array} dataArray - Data array to be modified
* @param {Number} itemsPerPage - The number of items per page to show
* @param {Number} pageNumber - The page number to show
*/
function paginateArray(dataArray, itemsPerPage = config.pagination.itemsPerPage, pageNumber = 1) {
  const pageNo = pageNumber - 1; // because pages logically start with 1, but technically with 0
  return dataArray.slice(pageNo * itemsPerPage, (pageNo + 1) * itemsPerPage);
}

const paginate = {
  mySql: paginateMySql,
  mongo: paginateMongo,
  paginateArray,
};

module.exports = paginate;
