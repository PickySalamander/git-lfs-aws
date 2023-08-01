/** Response to a batch request by an LFS client */
export interface BatchResponse {
	/** transfer adapter being used, only basic is currently supported */
	transfer:"basic";

	/** An Array of objects to download or upload */
	objects:BatchResponseAction[];

	/** The hash algorithm used to name Git LFS objects for this repository */
	hash_algo?:string;
}

/** Object that the client can upload or download */
export interface BatchResponseAction {
	/** String OID of the LFS object. */
	oid:string;

	/** Integer byte size of the LFS object. Must be at least zero. */
	size:number;

	/** Optional boolean specifying whether the request for this specific object is authenticated. */
	authenticated:boolean;
}

/** Object that the client can upload */
export interface BatchUploadAction extends BatchResponseAction {
	actions?:{
		upload:{
			/** String URL to upload the object. */
			href:string;

			/** Optional hash of String HTTP header key/value pairs to apply to the request. */
			header?:{ [key:string]:string };

			/** Whole number of seconds after local client time when transfer will expire. */
			expires_in:number;
		};
	}
}

/** Object that the client can download */
export interface BatchDownloadAction extends BatchResponseAction {
	actions?:{
		download:{
			/** String URL to upload the object. */
			href:string;

			/** Optional hash of String HTTP header key/value pairs to apply to the request. */
			header?:{ [key:string]:string };

			/** Whole number of seconds after local client time when transfer will expire. */
			expires_in:number;
		};
	}
}

/** The object can not be uploaded or downloaded */
export interface BatchError extends BatchResponseAction {
	error:{
		/** error code */
		code:number;

		/** A message explaining why */
		message:string;
	}
}