import {Construct} from 'constructs';
import {Duration, RemovalPolicy, Stack, StackProps} from "aws-cdk-lib";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {LambdaIntegration, RestApi, TokenAuthorizer} from "aws-cdk-lib/aws-apigateway";

/** CDK code to build the Git LFS serverless stack */
export class GitLfsAwsStack extends Stack {
	/** Bucket that objects and config are stored */
	private bucket:Bucket;

	/** IAM role that the lambda functions use */
	private role:Role;

	constructor(scope:Construct, id:string, props?:StackProps) {
		super(scope, id, props);

		//create the bucket
		this.bucket = new Bucket(this, "Bucket", {
			removalPolicy: RemovalPolicy.RETAIN
		});

		//setup the iam role
		this.createRole();

		//create the /batch api function
		const batchFunction = new NodejsFunction(this, "Batch", {
			description: "Handler for batch uploads of LFS files",
			runtime: Runtime.NODEJS_18_X,
			entry: "src/functions/batch.ts",
			handler: "handler",
			role: this.role,
			environment: {
				"S3_BUCKET": this.bucket.bucketName,
				"IS_PRODUCTION": "true"
			},
			logRetention: RetentionDays.ONE_MONTH,
			timeout: Duration.seconds(30)
		});

		//create the lambda custom authorizer for the api
		const authFunction = new NodejsFunction(this, "LfsAuth", {
			description: "Authorizes all requests to the server",
			runtime: Runtime.NODEJS_18_X,
			entry: "src/functions/lfs-auth.ts",
			handler: "handler",
			role: this.role,
			environment: {
				"S3_BUCKET": this.bucket.bucketName,
				"IS_PRODUCTION": "true"
			},
			logRetention: RetentionDays.ONE_MONTH,
			timeout: Duration.seconds(30)
		})

		//setup the authorizer and attach the lambda function
		const authorizer = new TokenAuthorizer(this, "Authorizer", {
			handler: authFunction,
			validationRegex: "^Basic [-0-9a-zA-Z\\+=]*$"
		})

		//setup the api
		const api = new RestApi(this, "Api", {
			description: "API for Git LFS",
		});

		//add the lambda functions and the authorizer to the api
		api.root
			.addResource("objects")
			.addResource("batch").addMethod("post", new LambdaIntegration(batchFunction), {
			authorizer: authorizer
		});
	}

	/** Create the IAM role for the lambda functions */
	private createRole():void {
		this.role = new Role(this, "Role", {
			description: "Generic role for Lambdas in  stack",
			assumedBy: new ServicePrincipal("lambda.amazonaws.com"),
			inlinePolicies: {
				//basic lambda permissions to make logs
				General: new PolicyDocument({
					statements: [
						new PolicyStatement({
							effect: Effect.ALLOW,
							actions: [
								"logs:DescribeLogStreams",
								"logs:CreateLogStream",
								"logs:CreateLogGroup",
								"logs:PutLogEvents",
								"s3:ListBucket"
							],
							resources: ["*"]
						})
					]
				}),

				S3Permissions: new PolicyDocument({
					statements: [
						new PolicyStatement({
							effect: Effect.ALLOW,
							actions: [
								"s3:GetObject",
								"s3:PutObject",
							],
							resources: [`${this.bucket.bucketArn}/*`]
						})
					]
				}),
			}
		});
	}
}
