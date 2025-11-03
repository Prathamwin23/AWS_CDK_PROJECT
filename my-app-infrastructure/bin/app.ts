#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/VpcStack';
import { RdsStack } from '../lib/RdsStack';
import { EcsStack } from '../lib/EcsStack';
import { CloudWatchStack } from '../lib/CloudWatchStack';
import { CiCdPipelineStack } from '../lib/CiCdPipelineStack';

const app = new cdk.App();

// Configuration
const environment = app.node.tryGetContext('environment') || 'dev';
const region = app.node.tryGetContext('region') || 'ap-south-1';
const account = '516268691462'; // Your AWS account ID
const alertEmail = app.node.tryGetContext('alertEmail') || 'your-email@example.com';

const env = {
  account,
  region,
};

// Stack 1: VPC - Network Foundation
const vpcStack = new VpcStack(app, `${environment}-VpcStack`, {
  environment,
  env,
  description: 'VPC with public, private, and database subnets',
});

// Stack 2: RDS - PostgreSQL Database
const rdsStack = new RdsStack(app, `${environment}-RdsStack`, {
  vpc: vpcStack.vpc,
  environment,
  env,
  description: 'RDS PostgreSQL database instance',
});
rdsStack.addDependency(vpcStack);

// Stack 3: ECS - Application Container Service
const ecsStack = new EcsStack(app, `${environment}-EcsStack`, {
  vpc: vpcStack.vpc,
  environment,
  dbSecret: rdsStack.dbSecret,
  dbEndpoint: rdsStack.dbInstance.dbInstanceEndpointAddress,
  env,
  description: 'ECS Fargate cluster with Application Load Balancer',
});
ecsStack.addDependency(vpcStack);
ecsStack.addDependency(rdsStack);

// Stack 4: CloudWatch - Monitoring & Alarms
const cloudWatchStack = new CloudWatchStack(app, `${environment}-CloudWatchStack`, {
  environment,
  ecsCluster: ecsStack.cluster,
  ecsService: ecsStack.fargateService,
  alertEmail,
  env,
  description: 'CloudWatch alarms and monitoring',
});
cloudWatchStack.addDependency(ecsStack);

// Stack 5: CI/CD Pipeline - CodeCommit + CodeBuild + CodePipeline
const cicdStack = new CiCdPipelineStack(app, `${environment}-CiCdPipelineStack`, {
  environment,
  ecrRepository: ecsStack.ecrRepository,
  ecsCluster: ecsStack.cluster,
  ecsService: ecsStack.fargateService,
  env,
  description: 'CI/CD Pipeline with CodeCommit, CodeBuild, and CodePipeline',
});
cicdStack.addDependency(ecsStack);

// Apply common tags
cdk.Tags.of(app).add('Project', 'MyApp');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();