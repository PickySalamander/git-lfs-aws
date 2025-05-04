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

		//set up the iam role
		this.createRole();

		//create the /batch api function
		const batchFunction = this.createFunction("Batch",
			"Handler for batch uploads of LFS files", "batch.ts");

		//create the lambda custom authorizer for the api
		const authFunction = this.createFunction("LfsAuth",
			"Authorizes all requests to the server", "lfs-auth.ts");

		//set up the authorizer and attach the lambda function
		const authorizer = new TokenAuthorizer(this, "Authorizer", {
			handler: authFunction,
			validationRegex: "^Basic [-0-9a-zA-Z\\+=]*$"
		})

		//set up the api
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

	private createFunction(name:string, description:string, file:string) {
		//create the /batch api function
		return new NodejsFunction(this, name, {
			description: description,
			runtime: Runtime.NODEJS_20_X,
			entry: `src/functions/${file}`,
			handler: "handler",
			role: this.role,
			environment: {
				"S3_BUCKET": this.bucket.bucketName,
				"IS_PRODUCTION": "true",
				"NODE_OPTIONS": "--enable-source-maps",
			},
			bundling: {
				externalModules: ["@aws-sdk/*"],
				metafile: true,
				minify: true,
				sourceMap: true
			},
			logRetention: RetentionDays.ONE_MONTH,
			timeout: Duration.seconds(30)
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
