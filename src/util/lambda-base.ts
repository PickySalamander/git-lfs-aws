import {Config} from "./config";
import {APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult} from "aws-lambda";
import {GetObjectCommand, S3Client} from "@aws-sdk/client-s3";

/** Base class for all Lambda functions */
export abstract class LambdaBase {
	/** Cached configuration from S3 */
	private _config:Config;

	/** Cached S3 client */
	private _s3:S3Client;

	/** The bucket used to load the JSON */
	protected readonly s3Bucket:string;

	constructor() {
		this.s3Bucket = process.env.S3_BUCKET as string;
	}

	/** Returns the loaded configuration if already loaded */
	async getConfig():Promise<Config> {
		if(!this._config) {
			console.log(`Loading config from s3://${this.s3Bucket}/config.json`);

			const s3Response = await this.s3.send(new GetObjectCommand({
				Key: "config.json",
				Bucket: this.s3Bucket
			}));

			if(!s3Response.Body) {
				throw `S3 result from ${this.s3Bucket}/config.json was empty`;
			}

			this._config = JSON.parse(await s3Response.Body.transformToString());
		}

		return this._config;
	}

	/**
	 * Helper function to return a web error to the LFS client
	 * @param statusCode the http status code to return
	 * @param message the message to give the client on why there was an error
	 * @param internal an optional internal message to log to the console log
	 * @return the proxy result
	 */
	protected static webError(statusCode:number, message:string, internal?:String):APIGatewayProxyResult {
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
			this._s3 = new S3Client({});
		}

		return this._s3;
	}
}

/** Base class for API gateway proxy functions */
export abstract class LambdaFunctionBase extends LambdaBase {
	public handler:APIGatewayProxyHandler = async(event:APIGatewayProxyEvent):Promise<APIGatewayProxyResult> => {
		//intercept all uncaught errors and return a message to the user properly
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
}
