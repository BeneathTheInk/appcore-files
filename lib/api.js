var _ = require("underscore"),
	Promise = require("bluebird"),
	multiparty = require("multiparty"),
	uuid = require("uuid"),
	asyncWait = require("asyncwait"),
	path = require("path");

module.exports = function(options) {
	var app = this;
	var router = app.router;
	var upload = app.files.upload;

	// file upload endpoint
	router.post(options.mountpath || '/upload',

	// must be signed in
	app.auth.secureRoute({ lock: true }),

	// handle the upload
	function(req, res, next){
		var fileurl, uploaderr;

		var wait = asyncWait(function() {
			if (uploaderr) return next(uploaderr);
			res.status(200);
			res.type("txt");
			res.send(fileurl);
		});

		var form = new multiparty.Form({
			maxFieldsSize: 10*1024, // 10kB
			maxFields: 1,
			autoFields: false,
			autoFiles: false
		});

		form.on('part', function(part) {
			// must be a file and have a field name 'data'
			if (part.name !== "data" || part.filename == null) return part.resume();

			Promise.try(function() {
				var ext = path.extname(part.filename),
					s3name = "/" + req.user._id + "/" + uuid.v1() + ext;

				return upload(part, s3name, {
					size: part.byteCount
				});
			}).then(function(url) {
				console.log(url);
				fileurl = url;
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
	});
}
