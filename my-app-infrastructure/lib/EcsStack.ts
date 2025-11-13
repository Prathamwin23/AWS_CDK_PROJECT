import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  environment: string;
  dbSecret?: secretsmanager.Secret;
  dbEndpoint: string;
}

export class EcsStack extends cdk.Stack {
  public readonly cluster: ecs.Cluster;
  public readonly fargateService: ecs.FargateService;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly ecrRepository: ecr.IRepository;

  constructor(scope: Construct, id: string, props?: EcsStackProps) {
    super(scope, id, props);
    const { vpc, environment, dbSecret, dbEndpoint } = props!;

    // Reference existing ECR repository from EcrStack
    this.ecrRepository = ecr.Repository.fromRepositoryName(
      this,
      'DjangoAppRepository',
      `${environment}/django-app`
    );

    // ECS Cluster
    this.cluster = new ecs.Cluster(this, 'DjangoCluster', {
      clusterName: `${environment}-django-cluster`,
      vpc: vpc,
      containerInsights: true,
    });

    // CloudWatch log group
    const logGroup = new logs.LogGroup(this, 'DjangoLogGroup', {
      logGroupName: `/ecs/${environment}/django-app`,
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
    if (dbSecret) {
      dbSecret.grantRead(executionRole);
    }

    // Task Role
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // Task Definition
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'DjangoTaskDef', {
      family: `${environment}-django-app`,
      memoryLimitMiB: 512,
      cpu: 256,
      executionRole: executionRole,
      taskRole: taskRole,
    });

    // Container Definition
    const containerConfig: any = {
      containerName: 'django-app',
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, 'latest'),
      portMappings: [{ containerPort: 8000, protocol: ecs.Protocol.TCP }],
      environment: {
        DEBUG: environment === 'prod' ? 'false' : 'true',
      },
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'django-app', logGroup: logGroup }),
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8000/health/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    };

    // Add database config only if dbSecret exists
    if (dbSecret) {
      containerConfig.environment.DB_HOST = props!.dbEndpoint;
      containerConfig.environment.DB_PORT = '3306';
      containerConfig.environment.DB_NAME = 'classicappdb';
      containerConfig.environment.DB_USER = 'classicadmin';
      containerConfig.secrets = { 
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password') 
      };
    }

    const djangoContainer = taskDefinition.addContainer('django-app', containerConfig);

    // ALB Security Group (Public - allow internet traffic)
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: vpc,
      description: 'Security group for Public Application Load Balancer',
      allowAllOutbound: true,
    });
    // Allow HTTP from anywhere (API Gateway will connect from internet)
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP from internet');

    // ECS Service Security Group
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc: vpc,
      description: 'Security group for ECS service',
      allowAllOutbound: true,
    });
    serviceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8000), 'Allow ALB to Django');

    // Application Load Balancer (Public - Internet-facing)
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'DjangoALB', {
      vpc: vpc,
      internetFacing: true, // Make it public so API Gateway can reach it
      loadBalancerName: `${environment}-django-public-alb`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC, // Use public subnets
      },
      securityGroup: albSecurityGroup,
    });

    // Target Group (Public ALB)
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'DjangoInternalTargetGroup', {
      vpc: vpc,
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,
      targetGroupName: `${environment}-django-public-tg`,
      healthCheck: {
        path: '/health/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // ALB Listener
    this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // ECS Service
    this.fargateService = new ecs.FargateService(this, 'DjangoService', {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      serviceName: `${environment}-django-service`,
      desiredCount: 1,
      minHealthyPercent: 0,
      maxHealthyPercent: 200,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [serviceSecurityGroup],
      assignPublicIp: false,
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      circuitBreaker: { rollback: true },
      enableExecuteCommand: true,
    });

    this.fargateService.attachToApplicationTargetGroup(targetGroup);

    // Auto Scaling
    const scaling = this.fargateService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3,
    });

    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    // Outputs
    new cdk.CfnOutput(this, 'LoadBalancerURL', {
      value: `http://${this.alb.loadBalancerDnsName}`,
      description: 'URL to access the Django application',
    });

    new cdk.CfnOutput(this, 'ECRRepositoryURI', {
      value: this.ecrRepository.repositoryUri,
      description: 'ECR Repository URI for pushing Docker images',
    });

    new cdk.CfnOutput(this, 'ECSClusterName', {
      value: this.cluster.clusterName,
      description: 'ECS Cluster Name',
    });
  }
}
