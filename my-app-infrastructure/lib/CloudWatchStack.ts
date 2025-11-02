import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export interface CloudWatchStackProps extends cdk.StackProps {
  environment: string;
  ecsCluster: ecs.Cluster;
  ecsService: ecs.FargateService;
  alertEmail: string;
}

export class CloudWatchStack extends cdk.Stack {
  public readonly snsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: CloudWatchStackProps) {
    super(scope, id, props);

    // Create SNS Topic for Alerts
    this.snsTopic = new sns.Topic(this, 'AlertsTopic', {
      topicName: `${props.environment}-app-alerts`,
      displayName: 'App Critical Alerts',
    });

    // Add email subscription
    this.snsTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(props.alertEmail)
    );

    // Alarm: No Healthy Tasks
    const noHealthyTasksAlarm = new cloudwatch.Alarm(this, 'NoHealthyTasksAlarm', {
      alarmName: `${props.environment}-no-healthy-tasks`,
      alarmDescription: 'Alert when no healthy tasks are running',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'HealthyHostCount',
        dimensionsMap: {
          ClusterName: props.ecsCluster.clusterName,
          ServiceName: props.ecsService.serviceName,
        },
        statistic: 'Minimum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    noHealthyTasksAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.snsTopic));

    // Outputs
    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: this.snsTopic.topicArn,
      description: 'SNS Topic ARN for Alerts',
      exportName: `${props.environment}-sns-topic-arn`,
    });
  }
}