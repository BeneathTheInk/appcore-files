var uploader = require("./upload");

module.exports = function(){
	if (this.files) return;

	var options = this.get("files") || {};

	// main api
	this.files = {
		upload: uploader(options.upload)
	};

	// register the default http adaptor
	this.files.upload.register("http", require("./http-adaptor.js"));

	// attach express upload middleware in Node.js
	if (this.isServer) this.files.express = require("./http-route.js").bind(null, this);
};
