import {GitPermissions} from "./git-permissions";

export interface UserContext extends GitPermissions {
	username:string;
}