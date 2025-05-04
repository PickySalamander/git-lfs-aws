#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {GitLfsAwsStack} from './git-lfs-aws-stack';

const app = new cdk.App();
new GitLfsAwsStack(app, 'GitLfsAwsStack', {
	description: "A Git LFS implementation that uses serverless exclusively"
});
