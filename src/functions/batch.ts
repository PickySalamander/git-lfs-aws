import {LambdaFunctionBase} from "../util/lambda-base";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda/trigger/api-gateway-proxy";
import {BatchDownloadAction, BatchError, BatchResponse, BatchUploadAction} from "../util/batch-response";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {GetObjectCommand, HeadObjectCommand, PutObjectCommand} from "@aws-sdk/client-s3";
import {UserContext} from "../util/user-context";

/**
 * Lambda function that performs the batch LFS functions as per the spec
 * <a href="https://github.com/git-lfs/git-lfs/blob/main/docs/api/README.md">here</a>.
 */
class Batch extends LambdaFunctionBase {
	protected async handle(event:APIGatewayProxyEvent):Promise<APIGatewayProxyResult> {
		//make sure there was a body
		if(!event.body) {
			return LambdaFunctionBase.webError(422, "no body", "Body was not specified");
		}

		//parse the body
		const body = JSON.parse(event.body) as BatchRequest;

		//only basic transfers are supported right now in the spec
		if(body.transfers && !body.transfers.includes("basic")) {
			return LambdaFunctionBase.webError(422, "Only basic transfer is supported");
		}

		//gt the user that is making a request. This is set up when the user is authorized.
		const user = event.requestContext.authorizer as UserContext;
		if(!user) {
			return LambdaFunctionBase.webError(401, "auth not present");
		}

		console.log(`User ${user.username} requesting to batch ${body.operation} ${body.objects.length} objects`);

		//do whichever operation the user requested
		switch(body.operation) {
			case "upload":
				//only upload if they have the push permission to the repo
				if(!user.push) {
					return LambdaFunctionBase.webError(403, "no permission to write");
				}
				return await this.handleUploads(body.objects);
			case "download":
				return await this.handleDownloads(body.objects);
			default:
				return LambdaFunctionBase.webError(422, `${body.operation} operation not supported!`);
		}
	}

	/**
	 * Generate pre-signed urls for the object uploads by the user
	 * @param objects the objects that are requested for upload
	 */
	private async handleUploads(objects:BatchRequestObject[]):Promise<APIGatewayProxyResult> {
		//start crafting a response
		const response:BatchResponse = {
			transfer: "basic",
			objects: [],
			hash_algo: "sha256"
		}

		//get the config from the s3 (if it hasn't already)
		const config = await this.getConfig();

		console.log(`Generating ${objects.length} pre-signed urls with ${config.uploadExpiration} expiry`);

		//got through each object
		for(const object of objects) {
			//create an upload object for the response
			const objectResp:BatchUploadAction = {
				oid: object.oid,
				size: object.size,
				authenticated: true
			};

			response.objects.push(objectResp);

			// if the object isn't already in s3 then make a pre-signed, otherwise it will be omitted and lfs won't
			// upload the object
			if(!await this.doesObjectExist(object.oid)) {
				//create a pre-signed url for a put object command
				const signed = await getSignedUrl(this.s3, new PutObjectCommand({
					Bucket: this.s3Bucket,
					Key: object.oid,
					ContentType: "application/octet-stream",

					//restrict the size, this will prevent more than the size from being uploaded at least
					ContentLength: object.size
				}), {
					expiresIn: config.uploadExpiration
				});

				//add the url to the action
				objectResp.actions = {
					upload: {
						href: signed,
						expires_in: config.uploadExpiration
					}
				};
			}
		}

		console.log("Completed");

		//return the response
		return {
			statusCode: 200,
			body: JSON.stringify(response),
			headers: {"Content-Type": "application/vnd.git-lfs+json"},
		}
	}

	/**
	 * Generate pre-signed urls for the object downloads by the user
	 * @param objects the objects that are requested for download
	 */
	private async handleDownloads(objects:BatchRequestObject[]):Promise<APIGatewayProxyResult> {
		//start crafting a response
		const response:BatchResponse = {
			transfer: "basic",
			objects: [],
			hash_algo: "sha256"
		}

		//get the config from the s3 (if it hasn't already)
		const config = await this.getConfig();

		console.log(`Generating ${objects.length} pre-signed urls with ${config.downloadExpiration} expiry`);

		//got through each object
		for(const object of objects) {
			//generate only if the object already exists
			if(await this.doesObjectExist(object.oid)) {
				//create a download object for the response
				const objectResp:BatchDownloadAction = {
					oid: object.oid,
					size: object.size,
					authenticated: true
				};

				response.objects.push(objectResp);

				//create a signed download url
				const signed = await getSignedUrl(this.s3, new GetObjectCommand({
					Bucket: this.s3Bucket,
					Key: object.oid
				}), {
					expiresIn: config.downloadExpiration
				});

				//add the url to the action
				//add the url to the action
				objectResp.actions = {
					download: {
						href: signed,
						expires_in: config.downloadExpiration
					}
				};
			} else {
				console.warn(`Object ${object.oid} was not found in S3`);

				//if there was no object found then put an error object in the response
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

		//return a response to the user
		return {
			statusCode: 200,
			body: JSON.stringify(response),
			headers: {"Content-Type": "application/vnd.git-lfs+json"},
		}
	}

	/**
	 * Make a head request to S3 to determine if an LFS object exists
	 * @param oid the object id to check
	 */
	private async doesObjectExist(oid:string) {
		try {
			//make the head request
			await this.s3.send(new HeadObjectCommand({
				Bucket: this.s3Bucket,
				Key: oid
			}));
		} catch(e:any) {
			//if there is a not found error, then the object is missing
			if(e.name == "NotFound") {
				return false;
			} else {
				throw e;
			}
		}

		return true;
	}
}

/** The request that the client makes */
interface BatchRequest {
	/** The operation being made */
	operation:"download" | "upload";

	/**
	 * An optional Array of String identifiers for transfer adapters that the client has configured. (basic is the only
	 * supported one)
	 */
	transfers?:string[];

	/** An array of objects to download or upload (depending on the {@link operation}) */
	objects:BatchRequestObject[],

	/** The hash algorithm used to name Git LFS objects. SHA256 is the only supported one now. */
	hash_algo:string;
}

/** An object to upload or download */
interface BatchRequestObject {
	/** String OID of the LFS object. */
	oid:string;

	/** Integer byte size of the LFS object. Must be at least zero. */
	size:number;
}

// noinspection JSUnusedGlobalSymbols
export const handler = new Batch().handler;