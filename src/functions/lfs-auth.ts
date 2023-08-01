import {
	APIGatewayAuthorizerResult,
	APIGatewayTokenAuthorizerEvent,
	APIGatewayTokenAuthorizerHandler
} from "aws-lambda/trigger/api-gateway-authorizer";
import {Octokit} from "octokit";
import {LambdaBase} from "../util/lambda-base";
import {GitPermissions} from "../util/git-permissions";

/**
 * Authorizer used to make sure the user has access to the repository and push / pull permissions. Users supply their
 * GitHub username and a user access token as their password.
 */
export class LfsAuth extends LambdaBase {
	public handler:APIGatewayTokenAuthorizerHandler = async(event:APIGatewayTokenAuthorizerEvent):Promise<APIGatewayAuthorizerResult> => {
		//if there is no token then deny
		if(!event.authorizationToken) {
			throw new Error("Deny");
		}

		try {
			console.log(`Handling authorization ${event.type} for ${event.methodArn}`);

			//get the username and password from the authentication header
			const base64 = event.authorizationToken.split(" ")[1];
			const [username, password] = Buffer.from(base64, "base64").toString().split(":");

			//validate and get the permissions with GitHub
			const permissions = await this.validateUser(username, password);

			console.log(`Validated ${username}, returning policy`);

			//return a policy allowing access to the rest of the api
			return this.createPolicy(username, event.methodArn, permissions);
		} catch(e) {
			console.error("Failed to authenticate user using basic authentication", e);
			throw new Error("Unauthorized");
		}
	}

	/**
	 * Validate the user has GitHub access to the repository
	 * @param username GitHub username
	 * @param password GitHub user access token
	 * @return their user permissions to the repository
	 */
	private async validateUser(username:string, password:string):Promise<GitPermissions> {
		//set up the rest api
		const octokit = new Octokit({
			auth: password
		});

		console.log(`Testing user "${username}" at github`);

		//get the user for the user access token and make sure they are the one who logged in
		const authenticated = await octokit.rest.users.getAuthenticated();
		if(authenticated.data.login.toLowerCase() != username.toLowerCase()) {
			throw "user mismatch";
		}

		//get the config
		const config = await this.getConfig();

		//get the repository in question to get the user's permissions
		const repoInfo = await octokit.rest.repos.get({
			repo: config.repo.repo,
			owner: config.repo.owner
		});

		//do they have permission to at least pull
		const permissions = repoInfo.data.permissions as GitPermissions;
		if(!permissions.pull) {
			throw "user doesn't have permission to repository";
		}

		//return the permissions
		return permissions;
	}

	/**
	 * Return a policy so the user can access the rest of the API
	 * @param username their username
	 * @param methodArn the method they are trying to access
	 * @param permissions the permissions they have on this repository
	 */
	private createPolicy(username:string, methodArn:string, permissions:GitPermissions):APIGatewayAuthorizerResult {
		const split = methodArn.split(":");
		const region = split[3];
		const accountId = split[4];

		const partials = split[5].split("/");
		const apiId = partials[0];
		const stage = partials[1];

		//return the policy
		return {
			principalId: username,
			policyDocument: {
				Version: '2012-10-17',
				Statement: [
					{
						Action: 'execute-api:Invoke',
						Effect: 'Allow',
						Resource: [
							`arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/POST/*`
						]
					}
				]
			},

			//add the user's information to be grabbed by other api methods
			context: {
				username,
				...permissions
			}
		};
	}
}

// noinspection JSUnusedGlobalSymbols
export const handler = new LfsAuth().handler;