/** Configuration loaded from S3 explaining how to run the LFS API */
export interface Config {
	/** Number of seconds until a pre-signed upload url expires */
	uploadExpiration:number;

	/** Number of seconds until a pre-signed download url expires */
	downloadExpiration:number;

	/** Information about the repository that is being LFS'd */
	repo:{
		/** The owner of the repository (user or org) */
		owner:string;

		/** The name of the repo */
		repo:string;
	}
}