#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/VpcStack';
import { EcrStack } from '../lib/EcrStack';
import { RdsStack } from '../lib/RdsStack';
import { BastionStack } from '../lib/BastionStack';
import { EcsStack } from '../lib/EcsStack';
import { ApiGatewayStack } from '../lib/ApiGatewayStack';
import { CloudWatchStack } from '../lib/CloudWatchStack';
import { CiCdPipelineStack } from '../lib/CiCdPipelineStack';

const app = new cdk.App();

// Configuration
const environment = app.node.tryGetContext('environment') || 'dev';
const region = app.node.tryGetContext('region') || 'ap-south-1';
const account = '516268691462'; // Your AWS account ID
const alertEmail = app.node.tryGetContext('alertEmail') || 'prathampatel02312003@gmail.com';

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

// Stack 2: ECR - Docker Image Repository
const ecrStack = new EcrStack(app, `${environment}-EcrStack`, {
  environment,
  env,
  description: 'ECR repository for Docker images',
});

// Stack 3: RDS - MySQL Database
const rdsStack = new RdsStack(app, `${environment}-RdsStack`, {
  vpc: vpcStack.vpc,
  environment,
  env,
  description: 'RDS MySQL database instance',
});
rdsStack.addDependency(vpcStack);

// Stack 3.5: Bastion Host for RDS Access
const bastionStack = new BastionStack(app, `${environment}-BastionStack`, {
  vpc: vpcStack.vpc,
  environment,
  dbSecurityGroup: rdsStack.dbSecurityGroup,
  env,
  description: 'Bastion host for RDS database access',
});
bastionStack.addDependency(vpcStack);

// Stack 4: ECS - Application Container Service
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
ecsStack.addDependency(ecrStack);

// Stack 5: API Gateway with Direct HTTP Integration
const apiGatewayStack = new ApiGatewayStack(app, `${environment}-ApiGatewayStack`, {
  environment,
  alb: ecsStack.alb,
  env,
  description: 'API Gateway with Direct HTTP Integration to ALB',
});
apiGatewayStack.addDependency(ecsStack);

// Stack 6: CloudWatch - Monitoring & Alarms
const cloudWatchStack = new CloudWatchStack(app, `${environment}-CloudWatchStack`, {
  environment,
  ecsCluster: ecsStack.cluster,
  ecsService: ecsStack.fargateService,
  alertEmail,
  env,
  description: 'CloudWatch alarms and monitoring',
});
cloudWatchStack.addDependency(ecsStack);

// Stack 7: CI/CD Pipeline - GitHub + CodeBuild + CodePipeline
const cicdStack = new CiCdPipelineStack(app, `${environment}-CiCdPipelineStack`, {
  environment,
  // Use existing resources by name instead of references
  githubOwner: 'Prathamwin23',
  githubRepo: 'AWS_CDK_PROJECT',
  githubBranch: 'master',
  env,
  description: 'CI/CD Pipeline with GitHub, CodeBuild, and CodePipeline',
});
// Remove dependency on stuck ECS stack

// Apply common tags
cdk.Tags.of(app).add('Project', 'MyApp');
cdk.Tags.of(app).add('Environment', environment);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();