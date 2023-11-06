/**
 * Middleware to add noCache headers to prevent caching data in IE browsers
 * @param {Object} req - The Standard ExpressJS request variable
 * @param {Object} res - The Standard ExpressJS response variable
 * @param {Object} next - The Standard ExpressJS next callback function
 * Execute provided next callback function if success else stop execution
 */
function addNoCacheHeaders(req, res, next) {
  const userAgent = req.get('User-Agent') || '';

  if (userAgent.indexOf('MSIE') !== -1 || userAgent.indexOf('Trident') !== -1) {
    res.set({
      cacheSeconds: '0',
      useExpiresHeader: 'true',
      useCacheControlHeader: 'true',
      useCacheControlNoStore: 'true',
      // The above alone did not solve the problem in IE10, so here are some more;
      // Set to expire far in the past.
      Expires: 'Mon, 23 Aug 1982 12:00:00 GMT'
    });
    // Set standard HTTP/1.1 no-cache headers.
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate');
  }
  next();
}

module.exports = addNoCacheHeaders;
