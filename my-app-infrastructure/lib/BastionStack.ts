import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface BastionStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  environment: string;
  dbSecurityGroup: ec2.SecurityGroup;
}

export class BastionStack extends cdk.Stack {
  public readonly bastionHost: ec2.BastionHostLinux;

  constructor(scope: Construct, id: string, props?: BastionStackProps) {
    super(scope, id, props);

    const { vpc, environment, dbSecurityGroup } = props!;

    // Create bastion host
    this.bastionHost = new ec2.BastionHostLinux(this, 'BastionHost', {
      vpc,
      instanceName: `${environment}-bastion-host`,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2(),
      subnetSelection: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    // Allow bastion to connect to RDS
    dbSecurityGroup.addIngressRule(
      this.bastionHost.connections.securityGroups[0],
      ec2.Port.tcp(3306),
      'Allow bastion host to connect to MySQL'
    );

    // Install MySQL client on bastion host
    this.bastionHost.instance.addUserData(
      'yum update -y',
      'yum install -y mysql',
      'echo "MySQL client installed successfully" > /tmp/mysql-install.log'
    );

    // Output bastion host details
    new cdk.CfnOutput(this, 'BastionHostId', {
      value: this.bastionHost.instanceId,
      description: 'Bastion Host Instance ID',
    });

    new cdk.CfnOutput(this, 'BastionHostPublicIP', {
      value: this.bastionHost.instancePublicIp,
      description: 'Bastion Host Public IP',
    });

    new cdk.CfnOutput(this, 'SSMConnectCommand', {
      value: `aws ssm start-session --target ${this.bastionHost.instanceId}`,
      description: 'Command to connect to bastion host via SSM',
    });
  }
}