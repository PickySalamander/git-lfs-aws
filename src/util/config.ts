export interface Config {
	uploadExpiration:number;
	downloadExpiration:number;

	repo:{
		owner:string;
		repo:string;
	}
}