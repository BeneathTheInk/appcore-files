var _ = require("underscore");
var Promise = require("bluebird");
var async = require("async");
var mime = require('mime');
var utils = require("./utils");

// "custom" mime types
mime.define({ "audio/mp3" : [ "mp3" ] });

module.exports = function(options) {
	var adaptors = {};

	options = _.defaults({}, options, {
		maxFileSize: 5 * 1024 * 1024,
		allowedMimetypes: null
	});

	var mimetypes = options.allowedMimetypes && [].concat(options.allowedMimetypes);
	var maxSize = parseInt(options.maxFileSize, 10);
	if (isNaN(maxSize) || maxSize < 0) maxSize = 0;

	// file upload queue so it doesn't bottleneck
	var queue = async.queue(function(task, callback) {
		var p = task.adaptor.length === 2 ?
			Promise.cast(task.adaptor(task.data, task.meta)) :
			Promise.promisify(task.adaptor)(task.data, task.meta);

		return p.nodeify(callback);
	}, 3);

	var pushToQueue = Promise.promisify(queue.push, queue);

	// validates an upload request and pushes onto the queue
	var upload = function(data, meta) {
		var task = {}, err;

		if (!_.isObject(meta)) return Promise.reject(new Error("Missing upload metadata object."));
		task.meta = meta = _.clone(meta);

		// validate data
		if (data == null) return Promise.reject(new Error("Expecting non-null value for data."));

		// extract known properties from data
		if (utils.isBlob(data)) {
			if (meta.mimetype == null) meta.mimetype = data.type;
			meta.size = data.size;
		}
		else if (utils.isArrayBuffer(data)) {
			meta.size = data.byteLength;
		}
		else if (Buffer.isBuffer(data)) {
			meta.size = data.length;
		}
		else if (typeof data === "string") {
			meta.size = Buffer.byteLength(data);
		}

		// validate filename
		if (!_.isString(meta.filename) || meta.filename === "") {
			return Promise.reject(new Error("Expecting non-empty string for filename."));
		}

		// validate mimetype
		if (meta.mimetype == null) meta.mimetype = mime.lookup(meta.filename);
		if (!meta.mimetype) {
			err = new Error("Unknown file type for file '" + meta.filename + "'.");
			err.status = 400;
			return Promise.reject(err);
		}
		if (mimetypes && !mimetypes.some(function(t) {
			return meta.mimetype === t;
		})) {
			err = new Error("Unsupported file type '" + meta.mimetype + "'.");
			err.status = 400;
			return Promise.reject(err);
		}

		// validate the size
		if (meta.size == null) meta.size = data.length || data.size;
		if (typeof meta.size != "number") return Promise.reject(new Error("Missing file size. Please include in metadata."));
		if (isNaN(meta.size) || meta.size < 0) return Promise.reject(new Error("Invalid file size provided."));
		if (meta.size > maxSize) {
			err = new Error("File is " + utils.bytes(meta.size, 2) + " which exceeds the max size of " + utils.bytes(maxSize, 2) + ".");
			err.status = 400;
			return Promise.reject(err);
		}

		// default adaptor is the first adaptor
		task.adaptor = meta.adaptor;
		if (task.adaptor == null) {
			var akeys = _.keys(adaptors);
			if (!akeys.length) return Promise.reject(new Error("No adaptors have been registered."));
			task.adaptor = akeys[0];
		}

		// resolve adaptor from string name
		if (typeof task.adaptor == "string") {
			if (adaptors[task.adaptor] == null) return Promise.reject(new Error("Unknown adaptor '" + task.adaptor + "'"));
			task.adaptor = adaptors[task.adaptor];
		}

		// adaptor must be a function
		if (typeof task.adaptor != "function") {
			return Promise.reject(new Error("Expecting function or string for upload adaptor"));
		}

		// convert data to readable stream
		task.data = data.readable ? data : utils.toStream(data);

		return Promise.props(task).then(pushToQueue);
	};

	// registers an upload adaptor
	upload.register = function(name, fn) {
		if (_.isObject(name)) return _.each(name, upload.register);
		if (typeof fn === "string" && typeof name === "function") {
			var _fn = name;
			name = fn;
			fn = _fn;
		}

		if (typeof name !== "string") throw new Error("Expecting non-empty string for adaptor name.");
		if (typeof fn !== "function") throw new Error("Expecting function for adaptor.");

		adaptors[name] = fn;
	};

	return upload;
};
