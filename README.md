# Appcore Files

This is a file handling abstraction for Appcore, allowing easy upload of large data to any persistent location. This library works both in the browser and Node.js.

## Usage

Use this package as a plugin on any application:

```js
app.use(require("appcore-files"));
```

This will attach the `file` object to the app.

### Upload

```js
app.files.upload( data, meta [, cb ] ) -> Promise
```

Upload a file. Returns a promise that is fulfilled when the upload completes.

- `data` - A Buffer, Blob, String, ArrayBuffer, or Readable Stream of raw file data.
- `meta` - An object providing additional details about the file. This object is directly passed to the adaptor
	- `filename` _(required)_ - The original name of the file. This can be a full path or just the base name.
	- `size` - The byte length of the file. This is only required when using a format that doesn't inherently provide the size.
	- `mimetype` - The mime type of the file. While not required, it is generally recommended to include.
	- `adaptor` - A registered upload adaptor name or an adaptor method. This is what actually performs the upload.

#### Upload Adaptors

```js
app.files.upload.register( name, fn )
```

Registers an upload adaptor.

- `name` - The unique id of the adaptor. This can be used in the `meta.adaptor` property on upload.
- `fn` - The adaptor method. This method has a signature of `(data, meta, done)`, where done is callback to be called when complete.
