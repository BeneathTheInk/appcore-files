var Promise = require("bluebird");
var toStream = require('streamifier').createReadStream;
var blobToBuffer = Promise.promisify(require("blob-to-buffer"));
var arrayBufferToBuffer = require("arraybuffer-to-buffer");

// converts int to human bytes
exports.bytes = function(bytes, prec) {
	var sizes = ['B','KB','MB','GB','TB'];
	if (bytes === 0) return '0';
	var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	var v = bytes / Math.pow(1024, i);

	if (typeof prec !== "number" || isNaN(prec) || prec < 0) prec = 0;
	var m = Math.pow(10, prec);

	return (Math.round(v * m) / m) + sizes[i];
};

var isBlob = exports.isBlob = function(v) {
	return typeof Blob === "function" && v instanceof Blob;
};

var isArrayBuffer = exports.isArrayBuffer = function(v) {
	return typeof ArrayBuffer === "function" && v instanceof ArrayBuffer;
};

exports.toStream = function(v, opts) {
	return Promise.cast(v).then(function(v) {
		if (isBlob(v)) v = blobToBuffer(v);
		if (isArrayBuffer(v)) v = arrayBufferToBuffer(v);
		return v;
	}).then(function(v) {
		return toStream(v, opts);
	});
};
