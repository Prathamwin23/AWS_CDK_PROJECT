#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CiCdPipelineStack } from '../lib/CiCdPipelineStack';

const app = new cdk.App();

// Configuration
const environment = 'dev';
const region = 'ap-south-1';
const account = '516268691462';

const env = {
  account,
  region,
};

// Deploy only CI/CD Pipeline Stack
const cicdStack = new CiCdPipelineStack(app, `${environment}-CiCdPipelineStack`, {
  environment,
  githubOwner: 'Prathamwin23',
  githubRepo: 'AWS_CDK_PROJECT',
  githubBranch: 'master',
  env,
  description: 'CI/CD Pipeline with GitHub, CodeBuild, and CodePipeline',
});

// Apply common tags
cdk.Tags.of(app).add('Project', 'MyApp');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();