import {LambdaBase} from "../util/lambda-base";
import {APIGatewayProxyEvent, APIGatewayProxyResult} from "aws-lambda/trigger/api-gateway-proxy";

class Batch extends LambdaBase {
	protected async handle(event:APIGatewayProxyEvent):Promise<APIGatewayProxyResult> {
		if(!event.body) {
			return this.webError(422, "no body", "Body was not specified");
		}

		const body = JSON.parse(event.body) as BatchRequest;

		if(body.transfers && !body.transfers.includes("basic")) {
			return this.webError(422, "Only basic transfer is supported");
		}

		console.log(`here ${body.operation}`);

		switch(body.operation) {
			case "upload":
				return await this.handleUploads(body.objects);
			case "download":
				return await this.handleDownloads(body.objects);
			default:
				return this.webError(422, `${body.operation} operation not supported!`);
		}
	}

	private async handleUploads(objects:BatchRequestObject[]):Promise<APIGatewayProxyResult> {
		console.log("here");

		for(const object of objects) {
			try {
				await this.s3.headObject({
					Bucket: this.s3Bucket,
					Key: object.oid
				}).promise();
			} catch(e:any) {
				if(e.code == "NotFound") {

				} else {
					throw e;
				}
			}

			
		}

		throw "unsupported operation";
	}

	private async handleDownloads(objects:BatchRequestObject[]):Promise<APIGatewayProxyResult> {
		throw "unsupported operation";
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

interface BatchResponse {
	transfer:"basic";
	objects:BatchResponseObject[]
	hash_algo:string;
}

interface BatchResponseObject {
	oid:string;
	size:number;
	authenticated:boolean;
	actions?:{
		href?:string;
		header?:{ [key:string]:string };
		expires_in?:number;
		expires_at?:string;
	},
	error?: {
		code:number;
		message:string;
	}
	hash_algo:string;
}


// noinspection JSUnusedGlobalSymbols
export const handler = new Batch().handler;