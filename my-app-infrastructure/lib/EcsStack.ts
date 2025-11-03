import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

/**
 * Props interface for ECS Stack
 * This defines what inputs our stack needs from other stacks
 */
export interface EcsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;                           // VPC from VpcStack
  environment: string;                    // Environment name (dev/prod)
  dbSecret: secretsmanager.Secret;        // Database password from RdsStack
  dbEndpoint: string;                     // Database endpoint from RdsStack
}

/**
 * ECS Stack - Deploys containerized Django application
 * 
 * This stack creates:
 * 1. ECR Repository (to store Docker images)
 * 2. ECS Cluster (compute environment)
 * 3. Task Definition (container configuration)
 * 4. Application Load Balancer (distributes traffic)
 * 5. ECS Service (runs and maintains containers)
 */
export class EcsStack extends cdk.Stack {
  // Public properties that other stacks can access
  public readonly cluster: ecs.Cluster;
  public readonly fargateService: ecs.FargateService;
  public readonly alb: elbv2.ApplicationLoadBalancer;
  public readonly ecrRepository: ecr.Repository;

  constructor(scope: Construct, id: string, props?: EcsStackProps) {
    super(scope, id, props);

    const { vpc, environment, dbSecret, dbEndpoint } = props!;

    // ========================================
    // 1. ECR REPOSITORY
    // ========================================
    // Container registry to store our Django app Docker images
    this.ecrRepository = new ecr.Repository(this, 'DjangoAppRepository', {
      repositoryName: `${environment}/django-app`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,  // Delete when stack is destroyed
      emptyOnDelete: true,                        // Clean up images automatically
      imageScanOnPush: true,                     // Scan for vulnerabilities
    });

    // ========================================
    // 2. ECS CLUSTER
    // ========================================
    // Logical grouping of compute resources
    this.cluster = new ecs.Cluster(this, 'DjangoCluster', {
      clusterName: `${environment}-django-cluster`,
      vpc: vpc,
      containerInsights: true,  // Enable CloudWatch Container Insights for monitoring
    });

    // ========================================
    // 3. LOGGING
    // ========================================
    // CloudWatch log group for application logs
    const logGroup = new logs.LogGroup(this, 'DjangoLogGroup', {
      logGroupName: `/ecs/${environment}/django-app`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // 4. IAM ROLES
    // ========================================
    // Task Execution Role - allows ECS to pull images and write logs
    const executionRole = new iam.Role(this, 'TaskExecutionRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });
    // Grant permission to read database password from Secrets Manager
    dbSecret.grantRead(executionRole);

    // Task Role - permissions for the running container (minimal for security)
    const taskRole = new iam.Role(this, 'TaskRole', {
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // ========================================
    // 5. TASK DEFINITION
    // ========================================
    // Blueprint for how containers should run
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'DjangoTaskDef', {
      family: `${environment}-django-app`,
      memoryLimitMiB: 512,    // 0.5 GB RAM
      cpu: 256,               // 0.25 vCPU
      executionRole: executionRole,
      taskRole: taskRole,
    });

    // ========================================
    // 6. CONTAINER DEFINITION
    // ========================================
    // Configure the Django application container
    const djangoContainer = taskDefinition.addContainer('django-app', {
      containerName: 'django-app',
      image: ecs.ContainerImage.fromEcrRepository(this.ecrRepository, 'latest'),

      // Port mapping - Django runs on port 8000
      portMappings: [{
        containerPort: 8000,
        protocol: ecs.Protocol.TCP,
      }],

      // Environment variables (non-sensitive)
      environment: {
        DEBUG: environment === 'prod' ? 'false' : 'true',
        DB_HOST: dbEndpoint,
        DB_PORT: '3306',
        DB_NAME: 'classicappdb',
        DB_USER: 'classicadmin',
      },

      // Secrets (sensitive data from AWS Secrets Manager)
      secrets: {
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, 'password'),
      },

      // Logging configuration
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: 'django-app',
        logGroup: logGroup,
      }),

      // Health check - Django health endpoint
      healthCheck: {
        command: ['CMD-SHELL', 'curl -f http://localhost:8000/health/ || exit 1'],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(60),
      },
    });

    // ========================================
    // 7. SECURITY GROUPS
    // ========================================
    // ALB Security Group - controls traffic to load balancer
    const albSecurityGroup = new ec2.SecurityGroup(this, 'ALBSecurityGroup', {
      vpc: vpc,
      description: 'Security group for Application Load Balancer',
      allowAllOutbound: true,
    });
    // Allow HTTP traffic from internet
    albSecurityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow HTTP');

    // ECS Service Security Group - controls traffic to containers
    const serviceSecurityGroup = new ec2.SecurityGroup(this, 'ServiceSecurityGroup', {
      vpc: vpc,
      description: 'Security group for ECS service',
      allowAllOutbound: true,
    });
    // Allow traffic from ALB to Django
    serviceSecurityGroup.addIngressRule(albSecurityGroup, ec2.Port.tcp(8000), 'Allow ALB to Django');

    // Note: Database security group rules should be configured in RdsStack
    // to avoid circular dependencies

    // ========================================
    // 8. APPLICATION LOAD BALANCER
    // ========================================
    // Distributes incoming traffic across multiple containers
    this.alb = new elbv2.ApplicationLoadBalancer(this, 'DjangoALB', {
      vpc: vpc,
      internetFacing: true,  // Accessible from internet
      loadBalancerName: `${environment}-django-alb`,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,  // Deploy in public subnets
      },
      securityGroup: albSecurityGroup,
    });

    // Target Group - defines where ALB sends traffic
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'DjangoTargetGroup', {
      vpc: vpc,
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetType: elbv2.TargetType.IP,  // Fargate uses IP targeting

      // Health check configuration
      healthCheck: {
        path: '/',
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 3,
      },
    });

    // ALB Listener - listens for incoming requests
    this.alb.addListener('HTTPListener', {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultTargetGroups: [targetGroup],
    });

    // ========================================
    // 9. ECS SERVICE
    // ========================================
    // Runs and maintains desired number of tasks
    this.fargateService = new ecs.FargateService(this, 'DjangoService', {
      cluster: this.cluster,
      taskDefinition: taskDefinition,
      serviceName: `${environment}-django-service`,

      // Deployment configuration
      desiredCount: 1,          // Number of running tasks
      minHealthyPercent: 50,    // Minimum healthy tasks during deployment
      maxHealthyPercent: 200,   // Maximum tasks during deployment

      // Network configuration
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,  // Deploy in private subnets
      },
      securityGroups: [serviceSecurityGroup],
      assignPublicIp: false,    // No public IP needed (ALB handles internet traffic)

      // Health and deployment settings
      healthCheckGracePeriod: cdk.Duration.seconds(60),
      circuitBreaker: { rollback: true },  // Auto-rollback on failed deployments
      enableExecuteCommand: true,          // Allow ECS Exec for debugging
    });

    // Connect service to load balancer
    this.fargateService.attachToApplicationTargetGroup(targetGroup);

    // ========================================
    // 10. AUTO SCALING (Optional)
    // ========================================
    // Automatically adjust number of tasks based on load
    const scaling = this.fargateService.autoScaleTaskCount({
      minCapacity: 1,
      maxCapacity: 3,
    });

    // Scale based on CPU utilization
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
    });

    // ========================================
    // 11. OUTPUTS
    // ========================================
    // Export important values for other stacks or manual reference
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