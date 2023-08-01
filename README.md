# Git LFS AWS

A [Git LFS](https://git-lfs.com/) server that runs on AWS serverless-ly. The project uses the AWS CDK to launch a stack that allows uploads and downloads for LFS to be stored in S3 and queried via pre-signed URLS. This is all done the AWS Lambda, so it is very cost-effective. I built this for my personal projects, so it is by no means mean as a fully supported LFS server. Use it at your own risk and consider it more as an example on how to get started.

**NOTE**: Currently, locking is unsupported as I don't really need it for personal projects. This only works for GitHub.

## Purpose

Generally, I chose to make this one to make this project because I needed a cost-effective alternative to what currently exists. AWS storage costs are extremely cheap, so I decided on that. Especially since the project I had in mind was just over the GitHub GB limit.

The next requirement was a login system that wasn't too hard to maintain. After doing some research I decided to use GitHub personal access tokens for the user to login. That way I didn't have to maintain a database. 

I used both [git-lfs-s3](https://github.com/troyready/git-lfs-s3) and [Estranged.Lfs](https://github.com/alanedwardes/Estranged.Lfs) as inspiration for this project.

## How it works
1. Build and deploy the CDK stack.
2. Upload a `config.json` file to the newly created S3 bucket that was created (there is a sample [here](sample/config.json)).
3. Add the API Gateway to your `.lfsconfig` file in your project.
4. On your first pull / push your GitHub username and a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

## Useful commands
* `npm run build` compile all the Typescript, use only for local testing
* `npm run test` perform the jest unit tests
* `cdk deploy` deploy this stack to your default AWS account/region
