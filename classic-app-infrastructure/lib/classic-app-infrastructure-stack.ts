#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ClassicVpcStack } from '../lib/ClassicVpc';
import { ClassicRdsStack } from '../lib/ClassicRds';
import { ClassicS3Stack } from '../lib/ClassicS3';
import { ClassicEcsStack } from '../lib/ClassicEcsCluster';
import { ClassicApiGatewayStack } from '../lib/ClassicApiGateway';
import { ClassicCloudWatchStack } from '../lib/ClassicCloudWatch';

const app = new cdk.App();

// Configuration
const environment = app.node.tryGetContext('environment') || 'dev';
const region = app.node.tryGetContext('region') || 'eu-west-1';
const account = app.node.tryGetContext('account') || process.env.CDK_DEFAULT_ACCOUNT;
const alertEmail = app.node.tryGetContext('alertEmail') || 'your-email@example.com';

const env = {
  account,
  region,
};

// ============================================================================
// STACK 1: VPC - Network Foundation
// ============================================================================
const vpcStack = new ClassicVpcStack(app, `${environment}-ClassicVpc`, {
  environment,
  env,
  description: 'VPC with public, private, and database subnets',
});

// ============================================================================
// STACK 2: S3 - Storage
// ============================================================================
const s3Stack = new ClassicS3Stack(app, `${environment}-ClassicS3`, {
  environment,
  env,
  description: 'S3 buckets for assets and logs',
});

// ============================================================================
// STACK 3: RDS - PostgreSQL Database
// ============================================================================
const rdsStack = new ClassicRdsStack(app, `${environment}-ClassicRds`, {
  vpc: vpcStack.vpc,
  environment,
  env,
  description: 'RDS PostgreSQL database instance',
});
rdsStack.addDependency(vpcStack);

// ============================================================================
// STACK 4: ECS - Application Container Service
// ============================================================================
const ecsStack = new ClassicEcsStack(app, `${environment}-ClassicEcs`, {
  vpc: vpcStack.vpc,
  environment,
  dbSecret: rdsStack.dbSecret,
  dbEndpoint: rdsStack.dbInstance.dbInstanceEndpointAddress,
  dbSecurityGroup: rdsStack.dbSecurityGroup,
  env,
  description: 'ECS Fargate cluster with Application Load Balancer',
});
ecsStack.addDependency(vpcStack);
ecsStack.addDependency(rdsStack);

// Grant ECS task access to S3
s3Stack.assetsBucket.grantReadWrite(ecsStack.fargateService.taskDefinition.taskRole);

// ============================================================================
// STACK 5: API Gateway - Public API Endpoint (Optional)
// ============================================================================
const apiStack = new ClassicApiGatewayStack(app, `${environment}-ClassicApi`, {
  vpc: vpcStack.vpc,
  alb: ecsStack.alb,
  environment,
  env,
  description: 'API Gateway with VPC Link to ALB',
});
apiStack.addDependency(ecsStack);

// ============================================================================
// STACK 6: CloudWatch - Monitoring & Alarms
// ============================================================================
const cloudWatchStack = new ClassicCloudWatchStack(app, `${environment}-ClassicMonitoring`, {
  environment,
  ecsCluster: ecsStack.cluster,
  ecsService: ecsStack.fargateService,
  dbInstance: rdsStack.dbInstance,
  alb: ecsStack.alb,
  alertEmail,
  env,
  description: 'CloudWatch alarms and monitoring dashboard',
});
cloudWatchStack.addDependency(ecsStack);
cloudWatchStack.addDependency(rdsStack);

// ============================================================================
// Tags - Apply common tags to all resources
// ============================================================================
cdk.Tags.of(app).add('Project', 'ClassicApp');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');
cdk.Tags.of(app).add('Owner', 'DevOps');

app.synth();