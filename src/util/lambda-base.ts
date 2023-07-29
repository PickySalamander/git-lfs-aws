import {S3} from "aws-sdk";
import {Config} from "./config";
import {APIGatewayProxyHandler} from "aws-lambda";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda/trigger/api-gateway-proxy";

/** Base class for all Lambda functions */
export abstract class LambdaBase {
	/** Cached configuration from S3 */
	private _config:Config;

	/** Cached S3 client */
	private _s3:S3;

	/** The bucket used to load the JSON */
	protected readonly s3Bucket:string;

	constructor() {
		this.s3Bucket = process.env.S3_BUCKET as string;
	}

	public handler:APIGatewayProxyHandler = async(event:APIGatewayProxyEvent):Promise<APIGatewayProxyResult> => {
		try {
			return await this.handle(event);
		} catch(e) {
			console.error("Failed to run, uncaught error", e);

			return {
				statusCode: 500,
				body: '"internal server error"'
			};
		}
	}

	protected abstract handle(event:APIGatewayProxyEvent):Promise<APIGatewayProxyResult>;

	/** Returns the loaded configuration if already loaded */
	async getConfig():Promise<Config> {
		if(!this._config) {
			console.log(`Loading config from s3://${this.s3Bucket}/config.json`);

			const s3Response = await this.s3.getObject({
				Key: "config.json",
				Bucket: this.s3Bucket
			}).promise();

			if(!s3Response.Body) {
				throw `S3 result from ${this.s3Bucket}/config.json was empty`;
			}

			this._config = JSON.parse(s3Response.Body.toString());
		}

		return this._config;
	}

	protected webError(statusCode: number, message:string, internal?:String):APIGatewayProxyResult {
		if(internal) {
			console.warn(`Returning ${statusCode} error to user: ${internal}`);
		}

		return {
			body: JSON.stringify({
				message,
			}),
			statusCode
		};
	}

	/** Cached S3 client */
	get s3() {
		if(!this._s3) {
			this._s3 = new S3();
		}

		return this._s3;
	}
}

