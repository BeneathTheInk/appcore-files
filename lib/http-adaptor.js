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
		var req = http.request(params, function(res) {
			// get the result immediately
			// browser has a weird deferral bug
			getRawBody(res, {
				length: res.headers["content-length"],
				encoding: "utf-8"
			}).then(function(body) {
				resolve([ res, body ]);
			}).catch(reject);
		});
		req.on("error", reject);

		if (nativeFormData) {
			getRawBody(data).then(function(buf) {
				var blob = new Blob([ toArrayBuffer(buf) ], { type: meta.mimetype });
				formData.append("data", blob, meta.filename);
				req.end(formData);
			}).catch(reject);
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
	}).spread(function(res, body) {
		if (mime.extension(res.headers["content-type"]) === "json") {
			body = JSON.parse(body);
		}

		if (res.statusCode != 200) {
			var err = new Error(typeof body === "string" && body != "" ? body : "File upload failed.");
			err.status = res.statusCode;
			throw err;
		}

		return body;
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
