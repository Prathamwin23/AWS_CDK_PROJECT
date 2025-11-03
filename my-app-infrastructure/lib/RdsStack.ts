import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface RdsStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  environment: string;
}

export class RdsStack extends cdk.Stack {
  public readonly dbInstance: rds.DatabaseInstance;
  public readonly dbSecurityGroup: ec2.SecurityGroup;
  public readonly dbSecret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props?: RdsStackProps) {
    super(scope, id, props);

    const { vpc, environment } = props!;
    const envName = environment.toUpperCase();

    // Create database credentials secret
    this.dbSecret = new secretsmanager.Secret(this, 'DBCredentials', {
      secretName: `${environment}/classic-app/db-credentials`,
      description: 'RDS database credentials for Classic App',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'classicadmin',
        }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create security group for RDS
    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DBSecurityGroup', {
      vpc,
      securityGroupName: `${environment}-classic-db-sg`,
      description: 'Security group for Classic App RDS MySQL',
      allowAllOutbound: false,
    });

    // Allow MySQL traffic from within VPC
    this.dbSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcp(3306),
      'Allow MySQL access from VPC'
    );

    // Create RDS Subnet Group
    const subnetGroup = new rds.SubnetGroup(this, 'DBSubnetGroup', {
      vpc,
      description: 'Subnet group for Classic App RDS',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      subnetGroupName: `${environment}-classic-db-subnet-group`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create RDS MySQL instance
    this.dbInstance = new rds.DatabaseInstance(this, 'MySQLInstance', {
      instanceIdentifier: `${environment}-classic-app-db`,
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_39, // MySQL 8.0 for Django compatibility
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO // Suitable for dev/staging
      ),
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      subnetGroup,
      securityGroups: [this.dbSecurityGroup],
      credentials: rds.Credentials.fromSecret(this.dbSecret),
      databaseName: 'classicappdb',
      allocatedStorage: 20, // 20 GB minimum
      storageType: rds.StorageType.GP2, // Use GP2 for better compatibility
      storageEncrypted: true,
      multiAz: false, // Set to true for production
      publiclyAccessible: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(7), // 7 days backup retention
      preferredBackupWindow: '03:00-04:00', // UTC time
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      deletionProtection: false, // Set to true for production
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT, // Create snapshot on delete
      cloudwatchLogsExports: ['error'], // Only enable error logs for simplicity
      enablePerformanceInsights: false, // Not supported on t3.micro
      // Remove monitoring interval to avoid issues
    });

    // Create custom log group for enhanced monitoring
    const logGroup = new logs.LogGroup(this, 'DBLogGroup', {
      logGroupName: `/aws/rds/instance/${environment}-classic-app-db/error`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Outputs
    new cdk.CfnOutput(this, 'DBEndpoint', {
      value: this.dbInstance.dbInstanceEndpointAddress,
      description: 'RDS Endpoint Address',
      exportName: `${environment}-classic-db-endpoint`,
    });

    new cdk.CfnOutput(this, 'DBPort', {
      value: this.dbInstance.dbInstanceEndpointPort,
      description: 'RDS Port',
      exportName: `${environment}-classic-db-port`,
    });

    new cdk.CfnOutput(this, 'DBName', {
      value: 'classicappdb',
      description: 'Database Name',
      exportName: `${environment}-classic-db-name`,
    });

    new cdk.CfnOutput(this, 'DBSecretArn', {
      value: this.dbSecret.secretArn,
      description: 'DB Credentials Secret ARN',
      exportName: `${environment}-classic-db-secret-arn`,
    });

    new cdk.CfnOutput(this, 'DBSecurityGroupId', {
      value: this.dbSecurityGroup.securityGroupId,
      description: 'DB Security Group ID',
      exportName: `${environment}-classic-db-sg-id`,
    });
  }
}