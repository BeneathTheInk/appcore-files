var _ = require("underscore");
var http = require("http");
var url = require("url");
var Promise = require("bluebird");
var getRawBody = Promise.promisify(require("raw-body"));
var mime = require("mime");

var nativeFormData = true;
var FormData = global.FormData;
if (typeof FormData === "undefined") {
	FormData = require("form-data");
	nativeFormData = false;
}

module.exports = function(data, meta) {
	return new Promise(function(resolve, reject) {
		// formulate params from url on meta
		var params = meta.url;
		if (typeof params === "string") params = url.parse(params);
		if (!_.isObject(params)) throw new Error("Missing file upload url for HTTP adaptor.");
		params = _.extend({ method: meta.method || "POST" }, params);

		// form data handles the upload format
		var formData = new FormData();

		if (!nativeFormData) {
			formData.append("data", data, {
				filename: meta.filename,
				knownLength: meta.size,
				contentType: meta.mimetype
			});

			// attach formdata headers
	  		params.headers = formData.getHeaders(params.headers);
		}

		// create http request
		var req = http.request(params, resolve);
		req.on("error", reject);

		if (nativeFormData) {
			return getRawBody(data).then(function(buf) {
				var blob = new Blob([ toArrayBuffer(buf) ], { type: meta.mimetype });
				formData.append("data", blob, meta.filename);
				req.end(formData);
			});
		} else {
			// get content length
			formData.getLength(function(err, length) {
				if (err) return reject(err);

				// add content length
				req.setHeader('Content-Length', length);

				// pipe data to request
				formData.pipe(req);
			});
		}
	}).then(function(res) {
		return getRawBody(res, {
			length: res.headers["content-length"],
			encoding: "utf-8"
		}).then(function(val) {
			if (mime.extension(res.headers["content-type"]) === "json") {
				val = JSON.parse(val);
			}
			
			console.log(val);

			if (res.statusCode != 200) {
				var err = new Error(typeof val === "string" && val != "" ? val : "File upload failed.");
				err.status = res.statusCode;
				throw err;
			}

			return val;
		});
	});
}

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}
