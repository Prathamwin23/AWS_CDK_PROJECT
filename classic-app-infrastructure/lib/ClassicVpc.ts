import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface ClassicVpcStackProps extends cdk.StackProps {
  environment: string;
}

export class ClassicVpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props?: ClassicVpcStackProps) {
    super(scope, id, props);

    const { environment } = props!;
    const envName = environment.toUpperCase();

    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, `${envName}-Classic-VPC`, {
      vpcName: `${environment}-classic-app-vpc`,
      cidr: '10.0.0.0/16',
      natGateways: 1, // Cost optimization - single NAT gateway
      maxAzs: 2, // 2 Availability Zones for high availability
      enableDnsHostnames: true,
      enableDnsSupport: true,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 28,
          name: 'Database',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        }
      ],
    });

    // Add VPC Flow Logs for monitoring
    const logGroup = new cdk.aws_logs.LogGroup(this, 'VPCFlowLogs', {
      logGroupName: `/aws/vpc/${environment}-classic-app`,
      retention: cdk.aws_logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ec2.FlowLog(this, 'FlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(logGroup),
    });

    // Output VPC ID
    new cdk.CfnOutput(this, 'VPCId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
      exportName: `${environment}-classic-vpc-id`,
    });
