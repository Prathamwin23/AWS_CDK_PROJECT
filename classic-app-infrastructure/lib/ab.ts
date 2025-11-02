import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export interface ClassicCloudWatchStackProps extends cdk.StackProps {
  environment: string;
  ecsCluster: ecs.Cluster;
  ecsService: ecs.FargateService;
  dbInstance: rds.DatabaseInstance;
  alb: elbv2.ApplicationLoadBalancer;
  alertEmail: string;
}

export class ClassicCloudWatchStack extends cdk.Stack {
  public readonly snsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props?: ClassicCloudWatchStackProps) {
    super(scope, id, props);

    const { environment, ecsCluster, ecsService, dbInstance, alb, alertEmail } = props!;

    // Create SNS Topic for Critical Alerts ONLY
    this.snsTopic = new sns.Topic(this, 'CriticalAlertsTopic', {
      topicName: `${environment}-classic-critical-alerts`,
      displayName: 'Classic App Critical Alerts',
    });

    // Add email subscription
    this.snsTopic.addSubscription(
      new sns_subscriptions.EmailSubscription(alertEmail)
    );

    // ========================================================================
    // ALARM 1: Application Health - Critical
    // ========================================================================
    const appHealthAlarm = new cloudwatch.Alarm(this, 'AppHealthAlarm', {
      alarmName: `${environment}-classic-app-unhealthy`,
      alarmDescription: 'Critical: Application has no healthy tasks running',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/ECS',
        metricName: 'HealthyHostCount',
        dimensionsMap: {
          ClusterName: ecsCluster.clusterName,
          ServiceName: ecsService.serviceName,
        },
        statistic: 'Minimum',
        period: cdk.Duration.minutes(1),
      }),
      threshold: 1,
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.BREACHING,
    });

    appHealthAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.snsTopic));

    // ========================================================================
    // ALARM 2: Database Connection - Critical
    // ========================================================================
    const dbConnectionAlarm = new cloudwatch.Alarm(this, 'DBConnectionAlarm', {
      alarmName: `${environment}-classic-db-connections-high`,
      alarmDescription: 'Critical: Database connections exceeding 80% of max',
      metric: dbInstance.metricDatabaseConnections({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80, // 80% of max connections (adjust based on your instance)
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
    });

    dbConnectionAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.snsTopic));

    // ========================================================================
    // ALARM 3: High Error Rate - Critical
    // ========================================================================
    const errorRateAlarm = new cloudwatch.Alarm(this, 'ErrorRateAlarm', {
      alarmName: `${environment}-classic-5xx-errors-high`,
      alarmDescription: 'Critical: High 5XX error rate from ALB',
      metric: alb.metricHttpCodeTarget(
        elbv2.HttpCodeTarget.TARGET_5XX_COUNT,
        {
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
        }
      ),
      threshold: 10, // More than 10 errors in 5 minutes
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    errorRateAlarm.addAlarmAction(new cloudwatch_actions.SnsAction(this.snsTopic));

    // ========================================================================
    // CloudWatch Dashboard (Optional but Recommended)
    // ========================================================================
    const dashboard = new cloudwatch.Dashboard(this, 'Dashboard', {
      dashboardName: `${environment}-classic-app-dashboard`,
    });

    // ECS Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ECS CPU & Memory Utilization',
        left: [
          ecsService.metricCpuUtilization({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        right: [
          ecsService.metricMemoryUtilization({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
      })
    );

    // ALB Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'ALB Request Count & Latency',
        left: [
          alb.metricRequestCount({
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
          }),
        ],
        right: [
          alb.metricTargetResponseTime({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
      })
    );

    // Database Metrics
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS CPU & Connections',
        left: [
          dbInstance.metricCPUUtilization({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
        right: [
          dbInstance.metricDatabaseConnections({
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
          }),
        ],
      })
    );

    // Error Rate Widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Application Error Rate',
        left: [
          alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, {
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: '5XX Errors',
          }),
          alb.metricHttpCodeTarget(elbv2.HttpCodeTarget.TARGET_4XX_COUNT, {
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            label: '4XX Errors',
          }),
        ],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'SNSTopicArn', {
      value: this.snsTopic.topicArn,
      description: 'SNS Topic ARN for Critical Alerts',
      exportName: `${environment}-classic-sns-topic-arn`,
    });

    new cdk.CfnOutput(this, 'DashboardURL', {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}