import {LambdaFunctionBase} from "../util/lambda-base";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda/trigger/api-gateway-proxy";
import {BatchDownloadAction, BatchError, BatchResponse, BatchUploadAction} from "../util/batch-response";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {GetObjectCommand, HeadObjectCommand, PutObjectCommand} from "@aws-sdk/client-s3";
import {UserContext} from "../util/user-context";

class Batch extends LambdaFunctionBase {
	protected async handle(event:APIGatewayProxyEvent):Promise<APIGatewayProxyResult> {
		if(!event.body) {
			return this.webError(422, "no body", "Body was not specified");
		}

		const body = JSON.parse(event.body) as BatchRequest;

		if(body.transfers && !body.transfers.includes("basic")) {
			return this.webError(422, "Only basic transfer is supported");
		}

		const user = event.requestContext.authorizer as UserContext;
		if(!user) {
			return this.webError(401, "auth not present");
		}

		console.log(`User ${user.username} requesting to batch ${body.operation} ${body.objects.length} objects`);

		switch(body.operation) {
			case "upload":
				if(!user.push) {
					return this.webError(403, "no permission to write");
				}
				return await this.handleUploads(body.objects);
			case "download":
				return await this.handleDownloads(body.objects);
			default:
				return this.webError(422, `${body.operation} operation not supported!`);
		}
	}

	private async handleUploads(objects:BatchRequestObject[]):Promise<APIGatewayProxyResult> {
		const response:BatchResponse = {
			transfer: "basic",
			objects: [],
			hash_algo: "sha256"
		}

		const config = await this.getConfig();

		console.log(`Generating ${objects.length} pre-signed urls with ${config.uploadExpiration} expiry`);

		for(const object of objects) {
			const objectResp:BatchUploadAction = {
				oid: object.oid,
				size: object.size,
				authenticated: true
			};

			response.objects.push(objectResp);

			if(!await this.doesObjectExist(object.oid)) {
				const signed = await getSignedUrl(this.s3, new PutObjectCommand({
					Bucket: this.s3Bucket,
					Key: object.oid,
					ContentType: "application/octet-stream",
					ContentLength: object.size
				}), {
					expiresIn: config.uploadExpiration
				});

				objectResp.actions = {
					upload: {
						href: signed,
						expires_in: config.uploadExpiration
					}
				};
			}
		}

		console.log("Completed");

		return {
			statusCode: 200,
			body: JSON.stringify(response),
			headers: {"Content-Type": "application/vnd.git-lfs+json"},
		}
	}

	private async handleDownloads(objects:BatchRequestObject[]):Promise<APIGatewayProxyResult> {
		const response:BatchResponse = {
			transfer: "basic",
			objects: [],
			hash_algo: "sha256"
		}

		const config = await this.getConfig();

		console.log(`Generating ${objects.length} pre-signed urls with ${config.downloadExpiration} expiry`);

		for(const object of objects) {
			if(await this.doesObjectExist(object.oid)) {
				const objectResp:BatchDownloadAction = {
					oid: object.oid,
					size: object.size,
					authenticated: true
				};

				response.objects.push(objectResp);

				const signed = await getSignedUrl(this.s3, new GetObjectCommand({
					Bucket: this.s3Bucket,
					Key: object.oid
				}), {
					expiresIn: config.downloadExpiration
				});

				objectResp.actions = {
					download: {
						href: signed,
						expires_in: config.downloadExpiration
					}
				};
			} else {
				console.warn(`Object ${object.oid} was not found in S3`);

				response.objects.push({
					oid: object.oid,
					size: object.size,
					error: {
						code: 404,
						message: "Object not found"
					}
				} as BatchError);
			}
		}

		console.log("Completed");

		return {
			statusCode: 200,
			body: JSON.stringify(response),
			headers: {"Content-Type": "application/vnd.git-lfs+json"},
		}
	}

	private async doesObjectExist(oid:string) {
		try {
			await this.s3.send(new HeadObjectCommand({
				Bucket: this.s3Bucket,
				Key: oid
			}));
		} catch(e:any) {
			if(e.name == "NotFound") {
				return false;
			} else {
				throw e;
			}
		}

		return true;
	}
}

interface BatchRequest {
	operation:"download" | "upload";
	transfers?:string[];
	objects:BatchRequestObject[],
	hash_algo:string;
}

interface BatchRequestObject {
	oid:string;
	size:number;
}


// noinspection JSUnusedGlobalSymbols
export const handler = new Batch().handler;