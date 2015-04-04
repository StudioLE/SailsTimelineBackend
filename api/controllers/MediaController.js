var p = require('path')

/**
 * MediaController
 *
 * @description :: Server-side logic for managing media
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {
  file: {},



  upload: function(req, res) {
    // @todo Get timeline + event from request
    var event = {
      id: 13,
      timeline: 3
    }

    var user = req.session.user.username.toString()
    var timeline = event.timeline.toString()
    var name = event.id.toString()
    var dir = p.join('/embed', user, 'img', timeline)

    async.waterfall([
      function(cb) { // Validate
        var upload = req.file('file')._files[0].stream
        var errors = []
        var validated = true

        // Check number of files
        if(req.file('file')._files.length !== 1) {
          validated = false
          errors.push('Only 1 file is accepted')
        }

        // Check content type
        if ( ! _.contains(['image/jpeg', 'image/png'], upload.headers['content-type'])) {
          validated = false;
          errors.push('File type not accepted: ' + upload.headers['content-type'])
        }

        if(validated) {
          cb(null)
        }
        else {
          // Close the upstream pipe. This should surpress verbose EMAXBUFFER log but doesn't..
          upload.unpipe()
          cb('Failed validation', errors)
        }
      },
      function(cb) { // Upload to s3
        req.file('file').upload({
          maxBytes: 7.5 * 1000 * 1000, // 7.5 MB
          dirname: dir,
          // saveAs: function(stream, cb) {
          //   cb(null,  name + p.extname(stream.filename))
          // },
          adapter: require('skipper-s3'),
          key: sails.config.connections.s3.key,
          secret: sails.config.connections.s3.secret,
          bucket: sails.config.connections.s3.bucket,
        }, function (err, files) {
          if(err){
            cb(err)
            return res.negotiate(err);
          }
          else if(files.length === 0) {
            cb('No file was uploaded')
            return res.badRequest('No file was uploaded');
          }
          else {
            cb(null, files)
          }
        });
      },
      function(files, cb) { // Add to model
        // @todo Auto generate thumbnail
        data = req.params.all()
        _.extend(data, {
          media: files[0].fd
        })
        Media.create(data, function(err, items) {
          if(err) cb(err)
          cb(null, items)
        })
      }
    ], function(err, result) { // Complete
      if(err) {
        return res.forbidden({
          error: err,
          data: result
        })
      }
      else {
        return res.ok(result)
      }
    })

  }
};
