import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ClassicApiGatewayStackProps extends cdk.StackProps {
  vpc: ec2.Vpc;
  alb: elbv2.ApplicationLoadBalancer;
  environment: string;
}

export class ClassicApiGatewayStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;
  public readonly vpcLink: apigateway.VpcLink;

  constructor(scope: Construct, id: string, props?: ClassicApiGatewayStackProps) {
    super(scope, id, props);

    const { vpc, alb, environment } = props!;

    // Create VPC Link to connect API Gateway to private ALB
    this.vpcLink = new apigateway.VpcLink(this, 'VpcLink', {
      vpcLinkName: `${environment}-classic-vpc-link`,
      targets: [alb as any],
      description: 'VPC Link for Classic App ALB',
    });

    // Create CloudWatch Log Group for API Gateway
    const logGroup = new logs.LogGroup(this, 'ApiGatewayLogs', {
      logGroupName: `/aws/apigateway/${environment}/classic-app`,
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create REST API
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${environment}-classic-app-api`,
      description: 'REST API for Classic App',
      deployOptions: {
        stageName: environment,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
        accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
          caller: true,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
        metricsEnabled: true,
        tracingEnabled: true,
        throttlingBurstLimit: 5000,
        throttlingRateLimit: 10000,
      },
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
        allowCredentials: true,
      },
    });

    // Create HTTP Integration with ALB
    const integration = new apigateway.Integration({
      type: apigateway.IntegrationType.HTTP_PROXY,
      integrationHttpMethod: 'ANY',
      uri: `http://${alb.loadBalancerDnsName}`,
      options: {
        connectionType: apigateway.ConnectionType.VPC_LINK,
        vpcLink: this.vpcLink,
        requestParameters: {
          'integration.request.path.proxy': 'method.request.path.proxy',
        },
      },
    });

    // Add proxy resource to forward all requests
    const proxyResource = this.api.root.addResource('{proxy+}');
    proxyResource.addMethod('ANY', integration, {
      requestParameters: {
        'method.request.path.proxy': true,
      },
    });

    // Add root resource method
    this.api.root.addMethod('ANY', integration);

    // Add API Gateway Usage Plan (for rate limiting and quotas)
    const plan = this.api.addUsagePlan('UsagePlan', {
      name: `${environment}-classic-usage-plan`,
      description: 'Usage plan for Classic App API',
      throttle: {
        rateLimit: 10000,
        burstLimit: 5000,
      },
      quota: {
        limit: 1000000,
        period: apigateway.Period.MONTH,
      },
    });

    // Associate usage plan with API stage
    plan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Create API Key (optional - for authenticated access)
    const apiKey = this.api.addApiKey('ApiKey', {
      apiKeyName: `${environment}-classic-api-key`,
      description: 'API Key for Classic App',
    });

    plan.addApiKey(apiKey);

    // Outputs
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url,
      description: 'API Gateway URL',
      exportName: `${environment}-classic-api-url`,
    });

    new cdk.CfnOutput(this, 'ApiId', {
      value: this.api.restApiId,
      description: 'API Gateway ID',
      exportName: `${environment}-classic-api-id`,
    });

    new cdk.CfnOutput(this, 'ApiKeyId', {
      value: apiKey.keyId,
      description: 'API Key ID',
      exportName: `${environment}-classic-api-key-id`,
    });
  }
}