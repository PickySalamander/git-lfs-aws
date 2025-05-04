import {GitLfsAwsStack} from "../src/git-lfs-aws-stack";
import {Template} from "aws-cdk-lib/assertions";
import {App} from "aws-cdk-lib";

describe("Stack Test", () => {
	test('Stack Test', () => {
		const app = new App();
		const stack = new GitLfsAwsStack(app, 'TestStack');

		const template = Template.fromStack(stack);

		template.hasResource("AWS::S3::Bucket", {
			UpdateReplacePolicy: "Retain",
			DeletionPolicy: "Retain"
		});

		template.resourceCountIs("AWS::Lambda::Function", 3);

		const functions = template.findResources("AWS::Lambda::Function");
		for(const [name, lambda] of Object.entries(functions)) {
			if(!name.startsWith("LogRetention")) {
				expect(lambda.Properties.Role).not.toBeNull();
				expect(lambda.Properties.Runtime).toBe("nodejs20.x")
				expect(lambda.Properties.Handler).toBe("index.handler")
			}
		}

		template.resourceCountIs("AWS::ApiGateway::RestApi", 1);
		const api = template.findResources("AWS::ApiGateway::RestApi");
		const apiName = Object.entries(api)[0][0];

		template.resourceCountIs("AWS::ApiGateway::Authorizer", 1);

		template.hasResourceProperties("AWS::ApiGateway::Authorizer", {
			"RestApiId": {
				"Ref": apiName
			},
			"Type": "TOKEN",
			"IdentitySource": "method.request.header.Authorization",
		});

		template.hasResourceProperties("AWS::ApiGateway::Method", {
			"HttpMethod": "POST",
			"AuthorizationType": "CUSTOM"
		})
	});
});
