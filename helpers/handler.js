
var requestErrorHandler = function(e){
  this.jsend.fail({
    message: e.message,
    data: e
  })
}

module.exports = {
  requestErrorHandler: requestErrorHandler
}
