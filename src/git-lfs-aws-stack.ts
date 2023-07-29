import {Construct} from 'constructs';
import {RemovalPolicy, Stack, StackProps} from "aws-cdk-lib";
import {Bucket} from "aws-cdk-lib/aws-s3";
import {NodejsFunction} from "aws-cdk-lib/aws-lambda-nodejs";
import {Runtime} from "aws-cdk-lib/aws-lambda";
import {Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal} from "aws-cdk-lib/aws-iam";
import {RetentionDays} from "aws-cdk-lib/aws-logs";
import {LambdaIntegration, RestApi} from "aws-cdk-lib/aws-apigateway";

export class GitLfsAwsStack extends Stack {
	private bucket:Bucket;
	private role:Role;

	constructor(scope:Construct, id:string, props?:StackProps) {
		super(scope, id, props);

		this.bucket = new Bucket(this, "Bucket",
			{
				removalPolicy: RemovalPolicy.RETAIN
			});

		this.createRole();

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
			logRetention: RetentionDays.ONE_MONTH
		});

		const api = new RestApi(this, "Api", {
			description: "API for Git LFS"
		});

		api.root.addResource("objects")
			.addResource("batch").addMethod("post", new LambdaIntegration(batchFunction));
	}

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
