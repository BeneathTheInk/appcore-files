var _ = require("underscore");
var http = require("http");
var Promise = require("bluebird");
var getRawBody = Promise.promisify(require("raw-body"));
var mime = require("mime");

var hasXHR = typeof XMLHttpRequest !== "undefined";
var _FormData = !hasXHR ? require("form-data") : global.FormData;

module.exports = function(data, meta) {
	return new Promise(function(resolve, reject) {
		// formulate params from url on meta
		if (!meta.url) throw new Error("Missing file upload url for HTTP adaptor.");
		var method = meta.method || "POST";

		// form data handles the upload format
		var formData = new _FormData();
		var req;

		if (hasXHR) {
			req = new XMLHttpRequest();
			req.open(method, meta.url);

			req.addEventListener("error", reject);
			req.addEventListener("load", function() {
				resolve([ req, req.responseText ]);
			});

			getRawBody(data).then(function(buf) {
				var blob = new Blob([ toArrayBuffer(buf) ], { type: meta.mimetype });
				formData.append("data", blob, meta.filename);
				req.send(formData);
			}).catch(reject);
		} else {
			var params = _.extend({ method: method }, params);

			formData.append("data", data, {
				filename: meta.filename,
				knownLength: meta.size,
				contentType: meta.mimetype
			});

			// attach formdata headers
			params.headers = formData.getHeaders(params.headers);

			// create http request
			req = http.request(params, function(res) {
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
		var type = typeof res.getResponseHeader === "function" ?
			res.getResponseHeader("Content-Type") :
			res.headers["content-type"];

		var status = typeof res.status === "number" ? res.status : res.statusCode;

		if (mime.extension(type) === "json") {
			body = JSON.parse(body);
		}

		if (status != 200) {
			var err = new Error(typeof body === "string" && body !== "" ? body : "File upload failed.");
			err.status = status;
			err.response = res;
			throw err;
		}

		return body;
	});
};

function toArrayBuffer(buffer) {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
    }
    return ab;
}
