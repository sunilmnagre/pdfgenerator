
/**
 * Get The files in the folder
 * Sort by Date -  sort in descending order
 * @param sftp
 * @param path
 * @returns {Promise}
 */
const getFiles = (sftp, path) => new Promise((resolve, reject) => {
  sftp.list(path).then((data) => {
    // Todo make sure Sort by Date -  sort in descending order
    const sortedFilesList = data.sort((a, b) => {
      const c = new Date(a.modifyTime);
      const d = new Date(b.modifyTime);
      return c - d;
    });
    resolve(sortedFilesList);
  }).catch((err) => {
    console.log(err.message);
    resolve([]);
  });
});

module.exports = {
  getFiles,
};
