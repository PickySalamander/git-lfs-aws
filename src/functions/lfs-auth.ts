import {
	APIGatewayAuthorizerResult,
	APIGatewayTokenAuthorizerEvent,
	APIGatewayTokenAuthorizerHandler
} from "aws-lambda/trigger/api-gateway-authorizer";
import {Octokit} from "octokit";
import {LambdaBase} from "../util/lambda-base";
import {GitPermissions} from "../util/git-permissions";

export class LfsAuth extends LambdaBase {
	public handler:APIGatewayTokenAuthorizerHandler = async(event:APIGatewayTokenAuthorizerEvent):Promise<APIGatewayAuthorizerResult> => {
		if(!event.authorizationToken) {
			throw new Error("Deny");
		}

		try {
			console.log(`Handling authorization ${event.type} for ${event.methodArn}`);

			const base64 = event.authorizationToken.split(" ")[1];
			const [username, password] = Buffer.from(base64, "base64").toString().split(":");

			const permissions = await this.validateUser(username, password);

			console.log(`Validated ${username}, returning policy`);

			return this.createPolicy(username, event.methodArn, permissions);
		} catch(e) {
			console.error("Failed to authenticate user using basic authentication", e);
			throw new Error("Unauthorized");
		}
	}

	private async validateUser(username:string, password:string):Promise<GitPermissions> {
		const octokit = new Octokit({
			auth: password
		});

		console.log(`Testing user "${username}" at github`);

		const authenticated = await octokit.rest.users.getAuthenticated();
		if(authenticated.data.login.toLowerCase() != username.toLowerCase()) {
			throw "user mismatch";
		}

		const config = await this.getConfig();

		const repoInfo = await octokit.rest.repos.get({
			repo: config.repo.repo,
			owner: config.repo.owner
		});

		const permissions = repoInfo.data.permissions as GitPermissions;
		if(!permissions.pull) {
			throw "user doesn't have permission to repository";
		}

		return permissions;
	}

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
			context: {
				username,
				...permissions
			}
		};
	}
}

// noinspection JSUnusedGlobalSymbols
export const handler = new LfsAuth().handler;