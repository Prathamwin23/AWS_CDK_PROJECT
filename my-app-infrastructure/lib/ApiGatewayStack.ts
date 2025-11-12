import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps extends cdk.StackProps {
  environment: string;
  alb: elbv2.ApplicationLoadBalancer;
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly api: apigateway.HttpApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const { environment, alb } = props;

    // ========================================
    // 1. CREATE SIMPLE HTTP INTEGRATION (Direct to public ALB)
    // ========================================
    const albIntegration = new integrations.HttpUrlIntegration(
      'AlbIntegration',
      `http://${alb.loadBalancerDnsName}`,
      {
        method: apigateway.HttpMethod.ANY,
      }
    );

    // ========================================
    // 3. CREATE HTTP API GATEWAY
    // ========================================
    this.api = new apigateway.HttpApi(this, 'DjangoApi', {
      apiName: `${environment}-django-api`,
      description: 'HTTP API Gateway with Direct HTTP Integration to Django ALB',
      defaultIntegration: albIntegration,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigateway.CorsHttpMethod.ANY],
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Enable detailed logging for debugging
    const stage = this.api.defaultStage?.node.defaultChild as apigateway.CfnStage;
    if (stage) {
      stage.accessLogSettings = {
        destinationArn: `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/apigateway/${environment}-django-api`,
        format: JSON.stringify({
          requestId: '$context.requestId',
          ip: '$context.identity.sourceIp',
          requestTime: '$context.requestTime',
          httpMethod: '$context.httpMethod',
          routeKey: '$context.routeKey',
          status: '$context.status',
          protocol: '$context.protocol',
          responseLength: '$context.responseLength',
          error: '$context.error.message',
          integrationError: '$context.integration.error',
          integrationStatus: '$context.integration.status',
          integrationLatency: '$context.integration.latency',
          responseLatency: '$context.responseLatency'
        })
      };
    }

    // ========================================
    // 5. OUTPUTS
    // ========================================
    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.api.url!,
      description: 'API Gateway URL (Public Endpoint)',
      exportName: `${environment}-api-gateway-url`,
    });

    new cdk.CfnOutput(this, 'IntegrationType', {
      value: 'Direct HTTP Integration',
      description: 'Integration Type (No VPC Link needed)',
      exportName: `${environment}-integration-type`,
    });

    new cdk.CfnOutput(this, 'AlbDnsName', {
      value: alb.loadBalancerDnsName,
      description: 'Internal ALB DNS Name (Private)',
      exportName: `${environment}-alb-dns`,
    });
  }
}
