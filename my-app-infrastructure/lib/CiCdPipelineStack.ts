import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface CiCdPipelineStackProps extends cdk.StackProps {
  environment: string;
  ecrRepository: ecr.Repository;
  ecsCluster: ecs.Cluster;
  ecsService: ecs.FargateService;
}

export class CiCdPipelineStack extends cdk.Stack {
  public readonly pipeline: codepipeline.Pipeline;
  public readonly sourceBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: CiCdPipelineStackProps) {
    super(scope, id, props);

    const { environment, ecrRepository, ecsCluster, ecsService } = props;

    // ========================================================================
    // STEP 1: Create S3 Bucket for Source Code
    // ========================================================================
    this.sourceBucket = new s3.Bucket(this, 'SourceBucket', {
      bucketName: `${environment}-my-app-source-${this.account}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
    });

    // ========================================================================
    // STEP 2: Create CodeBuild Project (Build Docker Image)
    // ========================================================================
    const buildProject = new codebuild.PipelineProject(this, 'BuildProject', {
      projectName: `${environment}-my-app-build`,
      description: 'Build Docker image and push to ECR',
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        privileged: true, // Required for Docker builds
        computeType: codebuild.ComputeType.SMALL,
      },
      environmentVariables: {
        ECR_REPOSITORY_URI: {
          value: ecrRepository.repositoryUri,
        },
        AWS_DEFAULT_REGION: {
          value: this.region,
        },
        AWS_ACCOUNT_ID: {
          value: this.account,
        },
        IMAGE_TAG: {
          value: 'latest',
        },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          pre_build: {
            commands: [
              'echo Logging in to Amazon ECR...',
              'aws ecr get-login-password --region $AWS_DEFAULT_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_DEFAULT_REGION.amazonaws.com',
              'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
              'IMAGE_TAG=${COMMIT_HASH:=latest}',
            ],
          },
          build: {
            commands: [
              'echo Build started on `date`',
              'echo Building the Docker image...',
              'docker build --no-cache -t $ECR_REPOSITORY_URI:latest .',
              'docker tag $ECR_REPOSITORY_URI:latest $ECR_REPOSITORY_URI:$IMAGE_TAG',
            ],
          },
          post_build: {
            commands: [
              'echo Build completed on `date`',
              'echo Pushing the Docker images...',
              'docker push $ECR_REPOSITORY_URI:latest',
              'docker push $ECR_REPOSITORY_URI:$IMAGE_TAG',
              'echo Writing image definitions file...',
              'printf \'[{"name":"django-app","imageUri":"%s"}]\' $ECR_REPOSITORY_URI:latest > imagedefinitions.json',
              'cat imagedefinitions.json',
            ],
          },
        },
        artifacts: {
          files: ['imagedefinitions.json'],
        },
      }),
    });

    // Grant permissions to CodeBuild
    ecrRepository.grantPullPush(buildProject);

    // ========================================================================
    // STEP 3: Create CodePipeline
    // ========================================================================
    
    // Artifacts
    const sourceOutput = new codepipeline.Artifact('SourceOutput');
    const buildOutput = new codepipeline.Artifact('BuildOutput');

    // Create Pipeline
    this.pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineName: `${environment}-my-app-pipeline`,
      restartExecutionOnUpdate: true,
    });

    // ========================================================================
    // STAGE 1: Source Stage (S3)
    // ========================================================================
    this.pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.S3SourceAction({
          actionName: 'S3_Source',
          bucket: this.sourceBucket,
          bucketKey: 'source.zip',
          output: sourceOutput,
          trigger: codepipeline_actions.S3Trigger.EVENTS,
        }),
      ],
    });

    // ========================================================================
    // STAGE 2: Build Stage (CodeBuild)
    // ========================================================================
    this.pipeline.addStage({
      stageName: 'Build',
      actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Docker_Build',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),
      ],
    });

    // ========================================================================
    // STAGE 3: Deploy Stage (ECS)
    // ========================================================================
    this.pipeline.addStage({
      stageName: 'Deploy',
      actions: [
        new codepipeline_actions.EcsDeployAction({
          actionName: 'ECS_Deploy',
          service: ecsService,
          input: buildOutput,
          deploymentTimeout: cdk.Duration.minutes(10),
        }),
      ],
    });

    // ========================================================================
    // Outputs
    // ========================================================================
    new cdk.CfnOutput(this, 'SourceBucketName', {
      value: this.sourceBucket.bucketName,
      description: 'S3 Bucket for Source Code',
      exportName: `${environment}-source-bucket-name`,
    });

    new cdk.CfnOutput(this, 'PipelineName', {
      value: this.pipeline.pipelineName,
      description: 'CodePipeline Name',
      exportName: `${environment}-pipeline-name`,
    });

    new cdk.CfnOutput(this, 'PipelineConsoleUrl', {
      value: `https://${this.region}.console.aws.amazon.com/codesuite/codepipeline/pipelines/${this.pipeline.pipelineName}/view`,
      description: 'CodePipeline Console URL',
    });

    new cdk.CfnOutput(this, 'DeploymentInstructions', {
      value: `To deploy: zip your code and upload as 'source.zip' to bucket '${this.sourceBucket.bucketName}'`,
      description: 'How to trigger deployments',
    });
  }
}