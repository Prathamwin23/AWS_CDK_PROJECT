import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export interface EcrStackProps extends cdk.StackProps {
  environment: string;
}

export class EcrStack extends cdk.Stack {
  public readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    const { environment } = props;

    // Create ECR Repository
    this.repository = new ecr.Repository(this, 'DjangoAppRepository', {
      repositoryName: `${environment}/django-app`,
      removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep repository even if stack is deleted
      emptyOnDelete: false, // Don't delete images
      imageScanOnPush: true,
      lifecycleRules: [
        {
          description: 'Keep last 10 images',
          maxImageCount: 10,
        },
      ],
    });

    // Output
    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: this.repository.repositoryUri,
      description: 'ECR Repository URI',
      exportName: `${environment}-ecr-repository-uri`,
    });

    new cdk.CfnOutput(this, 'RepositoryName', {
      value: this.repository.repositoryName,
      description: 'ECR Repository Name',
      exportName: `${environment}-ecr-repository-name`,
    });
  }
}
