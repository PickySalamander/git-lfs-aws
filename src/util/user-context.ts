import {GitPermissions} from "./git-permissions";

/** How user data is saved in the request context inside a lambda event */
export interface UserContext extends GitPermissions {
	/** The user's username */
	username:string;
}
