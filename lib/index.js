// var Manager = require('./manager.js');

module.exports = function(){
	if (this.files) return;

	this.use(require("@beneaththeink/appcore-s3"));
	this.use(require("@beneaththeink/appcore-auth"));

	this.use(function() {
		this.files = { upload: this.uploadToS3 };
	});

	this.use(function() {
		if (this.router && options.api !== false) require("./api").call(this, options);
	});
};
