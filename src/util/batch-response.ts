export interface BatchResponse {
	transfer:"basic";
	objects:BatchResponseAction[]
	hash_algo?:string;
}

export interface BatchResponseAction {
	oid:string;
	size:number;
	authenticated:boolean;
}

export interface BatchUploadAction extends BatchResponseAction {
	actions?:{
		upload:{
			href:string;
			header?:{ [key:string]:string };
			expires_in:number;
		};
	}
}

export interface BatchDownloadAction extends BatchResponseAction {
	actions?:{
		download:{
			href:string;
			header?:{ [key:string]:string };
			expires_in:number;
		};
	}
}

export interface BatchError extends BatchResponseAction {
	error:{
		code:number;
		message:string;
	}
}