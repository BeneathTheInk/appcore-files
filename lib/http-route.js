var _ = require("underscore"),
	Promise = require("bluebird"),
	multiparty = require("multiparty"),
	uuid = require("uuid"),
	asyncWait = require("asyncwait"),
	path = require("path");

module.exports = function(app, options) {
	options = _.defaults({}, options, {
		metadata: null,   // method to create the metadata object
		fieldName: "data" // formdata field name to look for data in
	});

	return function(req, res, next){
		var result, uploaderr;

		var wait = asyncWait(function() {
			if (uploaderr) return next(uploaderr);
			res.status(200);
			res.send(result);
		});

		var form = new multiparty.Form({
			maxFieldsSize: 10*1024, // 10kB
			maxFields: 1,
			autoFields: false,
			autoFiles: false
		});

		form.on('part', function(part) {
			// must be a file and have a field name 'data'
			if (part.name !== options.fieldName || part.filename == null) return part.resume();

			Promise.try(function() {
				var metadata = _.extend({
					filename: part.filename,
					size: part.byteCount,
					mimetype: part.headers["content-type"]
				}, _.isFunction(options.metadata) ? options.metadata(part, req) : null);

				return app.files.upload(part, metadata);
			}).then(function(_result) {
				result = _result;
			}, function(e) {
				uploaderr = e;
			}).finally(wait(function() {
				// support node v0.10 and v0.12
				if ((typeof part.isPaused === "function" && part.isPaused()) ||
					!part._readableState.flowing) part.resume();
			}));
		});

		form.on('close', wait());
		form.parse(req);
	}

}
