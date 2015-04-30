var _ = require("underscore"),
	Promise = require("bluebird"),
	mime = require("mime"),
	qs = require("querystring"),
	path = require("path");

module.exports = function() {
	var app = this, files;

	// self awareness
	while (files == null && app != null) {
		files = app.files;
		app = app.parent;
	}

	if (files) {
		this.files = files;
		return;
	}

	// export
	files = this.files = {};

	// "custom" mime types
	mime.define({ "audio/mp3" : [ "mp3" ] });
	files.mime = mime;

	// constants
	var FILE_TYPES      = files.FILE_TYPES      = [ "text", "image", "video", "audio", "other" ];
	var MAX_SIZE        = files.MAX_SIZE        = 50 * 1024 * 1024;
	var WHITELIST       = files.WHITELIST       = [ /*"txt", "css", */"jpeg", "png", "gif"/*, "mp3", "mp4"*/ ];

	// sends a blob to the server
	files.upload = function(blob, filename, url) {
		// validate file
		if (_.isEmpty(blob.type) || !_.contains(WHITELIST, mime.extension(blob.type)))
			throw new Error("Sorry, we can't handle that kind of file. We only accept ." + WHITELIST.join(", .") + " files.");

		if (blob.size > MAX_SIZE)
			throw new Error("That is file is too big. The maximum file size is " + bytes(MAX_SIZE) + ".");

		return new Promise(function(resolve, reject) {
			// form data handles the upload data
			var formData = new FormData();
			formData.append("data", blob, filename || blob.name);

			// new xhr request
			var req = new XMLHttpRequest();

			// deal with errors
			req.addEventListener("error", function(err) {
				console.error(err.stack);
				reject(new Error("File upload failed."));
			});

			// on load deal with the results
			req.addEventListener("load", function() {
				if (req.status != 200) {
					var err = new Error(!_.isEmpty(req.responseText) ? req.responseText : "File upload failed.");
					err.status = req.status;
					err.xhr = req;
					return reject(err);
				}

				resolve(req.responseText);
			});

			// make the request
			req.open("POST", url, true);
			req.send(formData);
		});
	}

	// converts int to human bytes
	var bytes = files.bytes = function(bytes) {
	    var sizes = ['B','KB','MB','GB','TB'];
	    if (bytes == 0) return '0';
	    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	    return Math.round(bytes / Math.pow(1024, i), 2) + sizes[i];
	}

	// gets blob data from a url
	files.download = function(url) {
		return new Promise(function(resolve, reject) {
			var req = new XMLHttpRequest();

			function onError() {
				var err = new Error("Failed to retrieve file.");
				err.statusCode = req.status;
				err.status = req.statusText;
				err.xhr = req;
				reject(err);
			}

			req.addEventListener("load", function() {
				if (req.status != 200) return onError();
				resolve(req.response);
			});

			req.addEventListener("error", onError);

			// req.withCredentials = true;
			req.responseType = 'blob';

			req.open("GET", url, true);
			req.send();
		});
	}

	// converts a blob into another format
	files.readBlob = function(blob, format) {
		var method = "readAsDataURL";

		switch(format) {
			case "base64":
			case "buffer":
				method = "readAsArrayBuffer";
				break;

			case "binary":
				method = "readAsBinaryString";
				break;

			case "text":
				method = "readAsText";
				break;
		}

		return new Promise(function(resolve, reject) {
			var reader = new FileReader();

			reader.addEventListener("error", function() {
				reject(reader.error);
			});

			reader.addEventListener("load", function() {
				var res = reader.result;
				if (format === "base64") res = base64ArrayBuffer(res);
				resolve(res);
			});

			reader[method](blob);
		});
	}
}

function base64ArrayBuffer(arrayBuffer) {
	var base64    = ''
	var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

	var bytes         = new Uint8Array(arrayBuffer)
	var byteLength    = bytes.byteLength
	var byteRemainder = byteLength % 3
	var mainLength    = byteLength - byteRemainder

	var a, b, c, d
	var chunk

	// Main loop deals with bytes in chunks of 3
	for (var i = 0; i < mainLength; i = i + 3) {
		// Combine the three bytes into a single integer
		chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

		// Use bitmasks to extract 6-bit segments from the triplet
		a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
		b = (chunk & 258048)   >> 12 // 258048   = (2^6 - 1) << 12
		c = (chunk & 4032)     >>  6 // 4032     = (2^6 - 1) << 6
		d = chunk & 63               // 63       = 2^6 - 1

		// Convert the raw binary segments to the appropriate ASCII encoding
		base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d]
	}

	// Deal with the remaining bytes and padding
	if (byteRemainder == 1) {
		chunk = bytes[mainLength]

		a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

		// Set the 4 least significant bits to zero
		b = (chunk & 3)   << 4 // 3   = 2^2 - 1

		base64 += encodings[a] + encodings[b] + '=='
	} else if (byteRemainder == 2) {
		chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

		a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
		b = (chunk & 1008)  >>  4 // 1008  = (2^6 - 1) << 4

		// Set the 2 least significant bits to zero
		c = (chunk & 15)    <<  2 // 15    = 2^4 - 1

		base64 += encodings[a] + encodings[b] + encodings[c] + '='
	}

	return base64
}
