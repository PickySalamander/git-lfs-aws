/** Permissions to user has to a repository */
export interface GitPermissions {
	/** They can push to the repository */
	push: boolean;

	/** They can pull from the repository */
	pull: boolean;
}