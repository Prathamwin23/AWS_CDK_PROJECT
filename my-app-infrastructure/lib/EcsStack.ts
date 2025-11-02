import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface ClassicEcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  environment: string;
  dbSecret: secretsmanager.Secret;
  dbEndpoint: string;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class ClassicEcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly fargateService: ecs.FargateService;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: ClassicEcsStackProps) {
    super(scope, id, props);

    const { vpc, environment, dbSecret, dbEndpoint, dbSecurityGroup } = props!;

    // Create ECR Repository
    this.ecrRepository = new ecr.Repository(this, 'AppRepository', {
      repositoryName: `${environment}/classic-app`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteImages: true,
      imageScanOnPush: true,
    });

    // Create ECS Cluster
    this.cluster = new ecs.Cluster(this, 'AppCluster', {
      clusterName: `${environment}-classic-app-cluster`,
      vpc,
      containerInsights: true,
    });

    // CloudWatch Log Group for Python app
    const logGroup = new logs.LogGroup(this, 'AppLogGroup', {
      logGroupName: `/ecs/${environment}/classic-app`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Task Execution Role
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    dbSecret.grantRead(executionRole);

    // Task Role (minimal permissions)
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Task Definition for Python Flask
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDef', {
      family: `${environment}-classic-app`,
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole,
      taskRole,
    });

    // Add Python app container
    const container = taskDefinition.addContainer('classic-app', {
      containerName: 'classic-app',
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, 'latest'),
      portMappings: [
        {
          containerPort: 5000, // Flask default port
          protocol: ecs.Protocol.TCP,
        },
      ],
      environment: {
        FLASK_ENV: environment === 'prod' ? 'production' : 'development',
        PORT: '5000',
        DB_HOST: dbEndpoint,
        DB_PORT: '5432',
        DB_NAME: 'classicappdb',
        DB_USER: 'classicadmin',
      },
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
      },
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'classic-app',
        logGroup,
      }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:5000/health || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // Application Load Balancer
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      internetFacing: true,
      loadBalancerName: `${environment}-classic-alb`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // ALB Security Group
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc,
      description: 'ALB security group',
      allowAllOutbound: true,
    });

    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'HTTP');
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'HTTPS');

    // ECS Service Security Group
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc,
      description: 'ECS service security group',
      allowAllOutbound: true,
    });

    serviceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(5000), 'Flask');
    dbSecurityGroup.addIngressRule(serviceSecurityGroup, ec2.Port.tcp(5432), 'PostgreSQL');

    // Target Group (port 5000 for Flask)
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'TargetGroup', {
      vpc,
      port: 5000, // Changed from 3000 to 5000
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      healthCheck: {
        path: '/health',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    // ALB Listener
    this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // Fargate Service
    this.fargateService = new ecs.FargateService(this, 'FargateService', {
      cluster: this.cluster,
      taskDefinition,
      serviceName: `${environment}-classic-app-service`,
      desiredCount: 1,
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [serviceSecurityGroup],
      assignPublicIp: false,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      circuitBreaker: {
        rollback: true,
      },
      enableExecuteCommand: true,
    });

    this.fargateService.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling
    const scaling = this.fargateService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 4,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 80,
      scaleInCooldown: cdk.Duration.seconds(60),
      scaleOutCooldown: cdk.Duration.seconds(60),
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: this.alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS Name',
      exportName: `${environment}-classic-alb-dns`,
    });

    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${environment}-classic-ecr-uri`,
    });

    new cdk.CfnOutput(this, 'ECSClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
      exportName: `${environment}-classic-cluster-name`,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: this.fargateService.serviceName,
      description: 'ECS Service Name',
      exportName: `${environment}-classic-service-name`,
    });